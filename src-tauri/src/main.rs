#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Unfold's file layer. Every path the window sends is relative to the notes
// folder and is checked by `safe` before anything touches the disk.

use base64::Engine;
use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
struct Note {
    path: String,
    mtime: u64,
    created: u64,
    body: String,
}

#[derive(Serialize)]
struct Scan {
    root: String,
    home: String,
    notes: Vec<Note>,
    dirs: Vec<String>,
    state: serde_json::Value,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn settings_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(err)?;
    fs::create_dir_all(&dir).map_err(err)?;
    Ok(dir.join("settings.json"))
}

/// The notes folder: the one the user picked, or ~/Documents/Unfold.
fn root(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(text) = fs::read_to_string(settings_file(app)?) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(r) = v.get("root").and_then(|r| r.as_str()) {
                let p = PathBuf::from(r);
                if p.is_dir() {
                    return Ok(p);
                }
            }
        }
    }
    let dir = app.path().document_dir().map_err(err)?.join("Unfold");
    fs::create_dir_all(&dir).map_err(err)?;
    Ok(dir)
}

/// Join a relative path onto the notes folder, refusing anything that could
/// escape it (absolute paths, `..`, and so on).
fn safe(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let p = Path::new(rel);
    if p.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err("That path is outside the notes folder.".into());
    }
    let full = root.join(p);
    // A link inside the notes folder must not lead out of it: check the nearest thing that exists.
    let real_root = root.canonicalize().map_err(err)?;
    let mut probe = full.as_path();
    loop {
        if probe.exists() {
            if !probe.canonicalize().map_err(err)?.starts_with(&real_root) {
                return Err("That path is outside the notes folder.".into());
            }
            break;
        }
        match probe.parent() {
            Some(up) => probe = up,
            None => break,
        }
    }
    Ok(full)
}

/// Writing help may only talk to a web address, never a file or another kind of link.
fn check_base(base: &str) -> Result<(), String> {
    if (base.starts_with("http://") || base.starts_with("https://")) && !base.chars().any(|c| c.is_control() || c.is_whitespace()) {
        Ok(())
    } else {
        Err("The Ollama address must start with http:// or https://".into())
    }
}

fn rel(root: &Path, p: &Path) -> String {
    p.strip_prefix(root).unwrap_or(p).to_string_lossy().replace('\\', "/")
}

fn created(p: &Path) -> u64 {
    fs::metadata(p)
        .and_then(|m| m.created())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or_else(|| mtime(p))
}

fn mtime(p: &Path) -> u64 {
    fs::metadata(p)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// If `p` is taken, try "name 2", "name 3" and so on.
fn unique(p: PathBuf) -> PathBuf {
    if !p.exists() {
        return p;
    }
    let stem = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let ext = p.extension().map(|s| s.to_string_lossy().to_string());
    for i in 2..10_000 {
        let name = match &ext {
            Some(e) => format!("{stem} {i}.{e}"),
            None => format!("{stem} {i}"),
        };
        let candidate = p.with_file_name(name);
        if !candidate.exists() {
            return candidate;
        }
    }
    p
}

fn walk(root: &Path, dir: &Path, depth: usize, notes: &mut Vec<Note>, dirs: &mut Vec<String>, bodies: bool) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let Ok(kind) = entry.file_type() else { continue };
        let path = entry.path();
        if kind.is_dir() {
            if depth < 2 {
                dirs.push(rel(root, &path));
            }
            if depth < 6 {
                walk(root, &path, depth + 1, notes, dirs, bodies);
            }
        } else if kind.is_file() && name.to_lowercase().ends_with(".md") {
            if !bodies {
                notes.push(Note { path: rel(root, &path), mtime: mtime(&path), created: 0, body: String::new() });
            } else if let Ok(body) = fs::read_to_string(&path) {
                notes.push(Note { path: rel(root, &path), mtime: mtime(&path), created: created(&path), body });
            }
        }
    }
}

#[tauri::command]
async fn scan(app: AppHandle) -> Result<Scan, String> {
    let root = root(&app)?;
    let (mut notes, mut dirs) = (Vec::new(), Vec::new());
    walk(&root, &root, 0, &mut notes, &mut dirs, true);
    let state = fs::read_to_string(root.join(".unfold").join("state.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    let home = app.path().home_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    Ok(Scan { root: root.to_string_lossy().to_string(), home, notes, dirs, state })
}

/// Removes a folder inside the notes folder, but only when it is empty.
#[tauri::command]
async fn remove_empty_dir(app: AppHandle, path: String) -> Result<(), String> {
    let root = root(&app)?;
    let p = safe(&root, &path)?;
    if path.is_empty() || p == root {
        return Err("That is the notes folder itself.".into());
    }
    // Finder's own bookkeeping file does not count as content.
    let _ = fs::remove_file(p.join(".DS_Store"));
    fs::remove_dir(&p).map_err(err)
}

/// A fingerprint of the notes folder (names and dates, no contents), so the app can tell
/// cheaply whether anything changed while it was in the background.
#[tauri::command]
async fn scan_sig(app: AppHandle) -> Result<String, String> {
    let root = root(&app)?;
    let (mut notes, mut dirs) = (Vec::new(), Vec::new());
    walk(&root, &root, 0, &mut notes, &mut dirs, false);
    let list: Vec<String> = notes.iter().map(|n| format!("{}:{}", n.path, n.mtime)).collect();
    Ok(format!("{}#{}#{}", root.to_string_lossy(), list.join("|"), dirs.join("|")))
}

#[tauri::command]
async fn write_note(app: AppHandle, path: String, body: String) -> Result<u64, String> {
    let root = root(&app)?;
    let p = safe(&root, &path)?;
    // Unfold only ever writes notes and the small pictures that come with its own Getting started notes.
    let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if !matches!(ext.as_str(), "md" | "markdown" | "txt" | "svg") {
        return Err("Unfold can only save notes.".into());
    }
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(err)?;
    }
    // Write beside the note, then swap it in, so a crash can't leave half a file.
    let tmp = p.with_extension("md.tmp");
    fs::write(&tmp, body).map_err(err)?;
    fs::rename(&tmp, &p).map_err(err)?;
    Ok(mtime(&p))
}

#[tauri::command]
async fn create_note(app: AppHandle, dir: String, name: String) -> Result<Note, String> {
    let root = root(&app)?;
    let folder = safe(&root, &dir)?;
    fs::create_dir_all(&folder).map_err(err)?;
    let p = unique(safe(&folder, &format!("{name}.md"))?);
    fs::write(&p, "").map_err(err)?;
    Ok(Note { path: rel(&root, &p), mtime: mtime(&p), created: created(&p), body: String::new() })
}

#[tauri::command]
async fn move_path(app: AppHandle, from: String, to: String) -> Result<String, String> {
    let root = root(&app)?;
    let a = safe(&root, &from)?;
    let wanted = safe(&root, &to)?;
    if a == wanted {
        return Ok(from);
    }
    // A change of capitals only is the same file on most Macs: rename it directly.
    let b = if from.to_lowercase() == to.to_lowercase() { wanted } else { unique(wanted) };
    if let Some(dir) = b.parent() {
        fs::create_dir_all(dir).map_err(err)?;
    }
    fs::rename(&a, &b).map_err(err)?;
    Ok(rel(&root, &b))
}

#[tauri::command]
async fn make_dir(app: AppHandle, path: String) -> Result<(), String> {
    let root = root(&app)?;
    fs::create_dir_all(safe(&root, &path)?).map_err(err)
}

#[tauri::command]
async fn trash_path(app: AppHandle, path: String) -> Result<(), String> {
    let root = root(&app)?;
    if path.is_empty() {
        return Err("Nothing to move to the Trash.".into());
    }
    trash::delete(safe(&root, &path)?).map_err(err)
}

#[tauri::command]
async fn save_state(app: AppHandle, state: serde_json::Value) -> Result<(), String> {
    let dir = root(&app)?.join(".unfold");
    fs::create_dir_all(&dir).map_err(err)?;
    fs::write(dir.join("state.json"), serde_json::to_string_pretty(&state).map_err(err)?).map_err(err)
}

#[tauri::command]
async fn pick_root(app: AppHandle) -> Result<Option<String>, String> {
    let Some(picked) = app.dialog().file().set_title("Choose where Unfold keeps your notes").blocking_pick_folder() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(err)?;
    let text = path.to_string_lossy().to_string();
    fs::write(settings_file(&app)?, serde_json::json!({ "root": text }).to_string()).map_err(err)?;
    Ok(Some(text))
}

#[tauri::command]
async fn set_root(app: AppHandle, path: String) -> Result<(), String> {
    if !Path::new(&path).is_dir() {
        return Err("That folder no longer exists.".into());
    }
    fs::write(settings_file(&app)?, serde_json::json!({ "root": path }).to_string()).map_err(err)
}

#[tauri::command]
async fn reveal_root(app: AppHandle) -> Result<(), String> {
    std::process::Command::new("open").arg(root(&app)?).spawn().map(|_| ()).map_err(err)
}

/// Shows one note or folder in Finder, selected.
#[tauri::command]
async fn reveal_path(app: AppHandle, path: String) -> Result<(), String> {
    let root = root(&app)?;
    let p = safe(&root, &path)?;
    if !p.exists() {
        return Err("It is no longer there.".into());
    }
    std::process::Command::new("open").arg("-R").arg(&p).spawn().map(|_| ()).map_err(err)
}

#[tauri::command]
async fn read_image(app: AppHandle, path: String) -> Result<Option<String>, String> {
    let root = root(&app)?;
    let p = safe(&root, &path)?;
    let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => return Ok(None),
    };
    let Ok(meta) = fs::metadata(&p) else { return Ok(None) };
    if !meta.is_file() || meta.len() > 12 * 1024 * 1024 {
        return Ok(None);
    }
    let bytes = fs::read(&p).map_err(err)?;
    Ok(Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes))))
}

#[tauri::command]
async fn export_file(app: AppHandle, name: String, content: String) -> Result<Option<String>, String> {
    let Some(picked) = app.dialog().file().set_file_name(&name).blocking_save_file() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(err)?;
    fs::write(&path, content).map_err(err)?;
    Ok(Some(path.to_string_lossy().to_string()))
}

// ---- AI on this Mac. Unfold only ever talks to the address in Settings,
// which is Ollama on this computer unless the user changes it.

/// The id of the request that may still stream. Anything else stops.
static AI_RUN: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize, Clone)]
struct Chunk {
    id: u64,
    text: String,
    error: Option<String>,
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().timeout_connect(Duration::from_secs(4)).build()
}

fn http_err(e: ureq::Error) -> String {
    match e {
        ureq::Error::Status(code, resp) => {
            let body = resp.into_string().unwrap_or_default();
            let msg = serde_json::from_str::<serde_json::Value>(&body)
                .ok()
                .and_then(|v| v["error"].as_str().map(String::from))
                .unwrap_or(body);
            format!("The model server answered {code}. {msg}")
        }
        other => format!("Could not reach the model server. {other}"),
    }
}

#[tauri::command]
async fn ai_models(base: String) -> Result<Vec<String>, String> {
    check_base(&base)?;
    tauri::async_runtime::spawn_blocking(move || {
        let url = format!("{}/api/tags", base.trim_end_matches('/'));
        let v: serde_json::Value = agent().get(&url).timeout(Duration::from_secs(6)).call().map_err(http_err)?.into_json().map_err(err)?;
        Ok(v["models"]
            .as_array()
            .map(|a| a.iter().filter_map(|m| m["name"].as_str().map(String::from)).collect())
            .unwrap_or_default())
    })
    .await
    .map_err(err)?
}

/// Opens a web link in the browser. Only http and https addresses are allowed.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let web = url.starts_with("https://") || url.starts_with("http://");
    if !web || url.len() > 2000 || url.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("Only web links can be opened".into());
    }
    std::process::Command::new("open").arg(&url).spawn().map(|_| ()).map_err(err)
}

/// Starts the Ollama app if it is installed. Fails when it is not.
#[tauri::command]
async fn ai_start() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let ok = std::process::Command::new("open").args(["-g", "-a", "Ollama"]).status().map_err(err)?.success();
        if ok { Ok(()) } else { Err("Ollama is not installed".to_string()) }
    })
    .await
    .map_err(err)?
}

#[derive(Clone, Serialize)]
struct Pull {
    model: String,
    status: String,
    done: u64,
    total: u64,
}

/// Downloads a model through Ollama, reporting progress as "ai-pull" events.
#[tauri::command]
async fn ai_pull(app: AppHandle, base: String, model: String) -> Result<(), String> {
    check_base(&base)?;
    tauri::async_runtime::spawn_blocking(move || {
        let url = format!("{}/api/pull", base.trim_end_matches('/'));
        let resp = agent()
            .post(&url)
            .send_json(serde_json::json!({ "model": model, "name": model, "stream": true }))
            .map_err(http_err)?;
        for line in BufReader::new(resp.into_reader()).lines() {
            let line = line.map_err(err)?;
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
            if let Some(e) = v["error"].as_str() {
                return Err(e.to_string());
            }
            let status = v["status"].as_str().unwrap_or("").to_string();
            let done = status == "success";
            let _ = app.emit("ai-pull", Pull { model: model.clone(), status, done: v["completed"].as_u64().unwrap_or(0), total: v["total"].as_u64().unwrap_or(0) });
            if done {
                break;
            }
        }
        Ok(())
    })
    .await
    .map_err(err)?
}

#[tauri::command]
async fn ai_run(app: AppHandle, base: String, model: String, system: String, prompt: String, id: u64) -> Result<(), String> {
    check_base(&base)?;
    AI_RUN.store(id, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || {
        let url = format!("{}/api/chat", base.trim_end_matches('/'));
        let body = |think: bool| {
            let mut b = serde_json::json!({
                "model": model,
                "stream": true,
                "messages": [{ "role": "system", "content": system }, { "role": "user", "content": prompt }]
            });
            if think {
                // Ask thinking models to answer directly; it is much faster.
                b["think"] = serde_json::json!(false);
            }
            b
        };
        // Some models reject the "think" setting, so fall back to a plain request.
        let resp = match agent().post(&url).send_json(body(true)) {
            Ok(r) => r,
            Err(ureq::Error::Status(400, _)) => agent().post(&url).send_json(body(false)).map_err(http_err)?,
            Err(e) => return Err(http_err(e)),
        };
        for line in BufReader::new(resp.into_reader()).lines() {
            if AI_RUN.load(Ordering::SeqCst) != id {
                break;
            }
            let line = line.map_err(err)?;
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
            if let Some(e) = v["error"].as_str() {
                return Err(e.to_string());
            }
            let text = v["message"]["content"].as_str().unwrap_or("").to_string();
            if !text.is_empty() {
                let _ = app.emit("ai-chunk", Chunk { id, text, error: None });
            }
            if v["done"].as_bool().unwrap_or(false) {
                break;
            }
        }
        Ok(())
    })
    .await
    .map_err(err)?
}

/// One short, complete answer from the local model, for the writing prompts. It does not stream and
/// does not interrupt a longer writing-help request. The model is kept loaded for a while afterwards,
/// and an empty prompt only loads it, so the first real question is quick.
#[tauri::command]
async fn ai_quick(base: String, model: String, system: String, prompt: String) -> Result<String, String> {
    check_base(&base)?;
    tauri::async_runtime::spawn_blocking(move || {
        let url = format!("{}/api/generate", base.trim_end_matches('/'));
        let body = |think: bool| {
            let mut b = serde_json::json!({
                "model": model,
                "stream": false,
                "keep_alive": "15m",
                "system": system,
                "prompt": prompt,
                "options": { "num_predict": 40, "temperature": 0.8 }
            });
            if think {
                b["think"] = serde_json::json!(false);
            }
            b
        };
        let wait = Duration::from_secs(60);
        let resp = match agent().post(&url).timeout(wait).send_json(body(true)) {
            Ok(r) => r,
            Err(ureq::Error::Status(400, _)) => agent().post(&url).timeout(wait).send_json(body(false)).map_err(http_err)?,
            Err(e) => return Err(http_err(e)),
        };
        let v: serde_json::Value = resp.into_json().map_err(err)?;
        Ok(v["response"].as_str().unwrap_or("").to_string())
    })
    .await
    .map_err(err)?
}

#[tauri::command]
fn ai_stop() {
    AI_RUN.store(0, Ordering::SeqCst);
}

/// Whether macOS's own on-device model tool is present and set up.
#[tauri::command]
async fn ai_apple_status() -> String {
    match std::process::Command::new("/usr/bin/fm").arg("--help").output() {
        Err(_) => "missing".into(),
        Ok(o) => {
            let text = format!("{}{}", String::from_utf8_lossy(&o.stdout), String::from_utf8_lossy(&o.stderr));
            if text.contains("LEGAL NOTICE") { "license".into() } else { "ready".into() }
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan, scan_sig, remove_empty_dir, write_note, create_note, move_path, make_dir, trash_path, save_state, pick_root, set_root, reveal_root, reveal_path, read_image, export_file,
            ai_models, ai_run, ai_stop, ai_apple_status, open_url, ai_start, ai_pull, ai_quick
        ])
        .run(tauri::generate_context!())
        .expect("error while running Unfold");
}
