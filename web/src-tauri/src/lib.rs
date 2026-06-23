#[cfg(target_os = "macos")]
use std::path::PathBuf;
#[cfg(target_os = "macos")]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![save_image_to_photos])
    .setup(|app| {
      #[cfg(target_os = "macos")]
      {
        start_macos_app(app)?;
      }
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
fn save_image_to_photos(data_url: String) -> Result<(), String> {
  save_image_to_photos_impl(&data_url)
}

#[cfg(target_os = "ios")]
fn save_image_to_photos_impl(data_url: &str) -> Result<(), String> {
  use base64::Engine;
  use objc2_foundation::NSData;
  use objc2_ui_kit::UIImage;
  use std::{ffi::c_void, ptr};

  #[link(name = "UIKit", kind = "framework")]
  extern "C" {
    fn UIImageWriteToSavedPhotosAlbum(
      image: &UIImage,
      completion_target: *mut c_void,
      completion_selector: *mut c_void,
      context_info: *mut c_void,
    );
  }

  let (_, payload) = data_url
    .split_once(',')
    .ok_or_else(|| "图片数据格式不正确".to_string())?;
  if !data_url.starts_with("data:image/") {
    return Err("只能保存图片到相册".to_string());
  }
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(payload)
    .map_err(|_| "图片数据解析失败".to_string())?;
  let data = NSData::with_bytes(&bytes);
  let image = UIImage::imageWithData(&data).ok_or_else(|| "图片数据无法读取".to_string())?;

  unsafe {
    UIImageWriteToSavedPhotosAlbum(&image, ptr::null_mut(), ptr::null_mut(), ptr::null_mut());
  }
  Ok(())
}

#[cfg(not(target_os = "ios"))]
fn save_image_to_photos_impl(_data_url: &str) -> Result<(), String> {
  Err("当前平台不支持直接保存到相册".to_string())
}

#[cfg(target_os = "macos")]
fn start_macos_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  use std::{
    net::TcpListener,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
  };
  struct AppProcesses {
    api: Child,
    web: Child,
  }

  impl Drop for AppProcesses {
    fn drop(&mut self) {
      let _ = self.web.kill();
      let _ = self.api.kill();
    }
  }

  let resource_dir = app.path().resource_dir()?.join("resources").join("macos");
  let api_port = free_port()?;
  let web_port = free_port()?;
  let api = Command::new(resource_dir.join("server"))
    .env("PORT", api_port.to_string())
    .env("PROMPT_DATA_DIR", app_data_dir(app)?.join("prompts"))
    .env("DATABASE_DSN", app_data_dir(app)?.join("infinite-canvas.db"))
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()?;

  let web_dir = resource_dir.join("web");
  let web = Command::new(resource_dir.join("node").join("bin").join("node"))
    .arg("server.js")
    .current_dir(&web_dir)
    .env("NODE_ENV", "production")
    .env("PORT", web_port.to_string())
    .env("HOSTNAME", "127.0.0.1")
    .env("API_BASE_URL", format!("http://127.0.0.1:{api_port}"))
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()?;

  app.manage(Mutex::new(AppProcesses { api, web }));
  let url = format!("http://127.0.0.1:{web_port}/canvas");
  let window = app.get_webview_window("main").ok_or("找不到主窗口")?;
  thread::spawn({
    let window = window.clone();
    let url = url.clone();
    move || {
      for _ in 0..120 {
        if TcpListener::bind(("127.0.0.1", web_port)).is_err() {
          let _ = window.navigate(url.parse().unwrap());
          return;
        }
        thread::sleep(Duration::from_millis(250));
      }
    }
  });

  Ok(())
}

#[cfg(target_os = "macos")]
fn free_port() -> std::io::Result<u16> {
  Ok(std::net::TcpListener::bind("127.0.0.1:0")?.local_addr()?.port())
}

#[cfg(target_os = "macos")]
fn app_data_dir(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
  let dir = app.path().app_data_dir()?;
  std::fs::create_dir_all(&dir)?;
  Ok(dir)
}
