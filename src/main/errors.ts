/**
 * Kullanıcıya gösterilmek üzere bizim yazdığımız hata. IPC katmanı (ipc.ts → forRenderer) arayüze yalnızca bu sınıfın
 * ve LlmError'un mesajlarını geçirir; diğer her hata günlüğe düşer ve arayüz genel bir mesaj görür.
 */
export class UserError extends Error {}
