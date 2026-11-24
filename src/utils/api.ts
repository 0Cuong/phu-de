const configuredBase = (import.meta.env.VITE_API_BASE_URL || '').trim();

export const API_BASE_URL = configuredBase.replace(/\/+$/, '');

// In development the Express/Vite server shares one origin. In production,
// static hosting needs an explicitly configured API origin.
export const isApiConfigured = Boolean(API_BASE_URL) || !import.meta.env.PROD;

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

export function apiUnavailableMessage(feature: string): string {
  return `${feature} cần máy chủ xử lý riêng. Website đang chạy trên GitHub Pages nhưng chưa được cấu hình VITE_API_BASE_URL. Bạn vẫn có thể xem video, biên tập phụ đề và xuất SRT/VTT/ASS; hãy triển khai backend theo README để bật AI và xuất MP4.`;
}
