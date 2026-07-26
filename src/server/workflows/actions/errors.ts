export class DomainActionValidationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409 = 400
  ) {
    super(message);
    this.name = "DomainActionValidationError";
  }
}
