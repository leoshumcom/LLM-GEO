// Hono 上下文变量声明
declare module 'hono' {
  interface ContextVariableMap {
    user: import('./types').JwtPayload;
  }
}
