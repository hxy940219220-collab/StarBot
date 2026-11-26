import { extname } from "node:path";

export function applicationContentType(
  path: string,
):
  | "text/html; charset=utf-8"
  | "text/javascript; charset=utf-8"
  | "text/css; charset=utf-8"
  | "application/json; charset=utf-8"
  | "image/svg+xml"
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "video/mp4"
  | "video/webm"
  | "audio/mpeg"
  | "audio/wav"
  | "font/woff2"
  | "application/octet-stream" {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}
