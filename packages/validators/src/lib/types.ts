export type Advice = {
  ok: boolean;
  level: 'error' | 'warn' | 'info';
  message: string;
  extra: Record<string, string | number | boolean | string[]>;
};
