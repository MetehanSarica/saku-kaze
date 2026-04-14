/**
 * toastStore — lightweight notification queue.
 * Consumed by Toast.svelte, pushed from anywhere via toastStore.error() etc.
 */

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

class ToastStore {
  toasts = $state<Toast[]>([]);

  private push(type: ToastType, message: string, duration: number): string {
    const id = `t${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.toasts = [...this.toasts, { id, type, message }];
    if (duration > 0) setTimeout(() => this.dismiss(id), duration);
    return id;
  }

  dismiss(id: string): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  error  (msg: string, ms = 8000): string { return this.push('error',   msg, ms); }
  warning(msg: string, ms = 6000): string { return this.push('warning', msg, ms); }
  info   (msg: string, ms = 5000): string { return this.push('info',    msg, ms); }
  success(msg: string, ms = 3000): string { return this.push('success', msg, ms); }
}

export const toastStore = new ToastStore();
