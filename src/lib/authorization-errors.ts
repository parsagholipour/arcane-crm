export class AppAuthorizationError extends Error {
  constructor(message: string, readonly status: 401 | 403 | 404 = 403) {
    super(message);
    this.name = "AppAuthorizationError";
  }
}
