export class EmailError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 502 | 503,
    readonly code: "validation" | "configuration" | "delivery"
  ) {
    super(message);
    this.name = "EmailError";
  }
}

export class EmailValidationError extends EmailError {
  constructor(message: string) {
    super(message, 400, "validation");
    this.name = "EmailValidationError";
  }
}

export class EmailConfigurationError extends EmailError {
  constructor(message = "Email delivery is not configured.") {
    super(message, 503, "configuration");
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends EmailError {
  constructor(message = "The email provider could not accept the message. Please retry.") {
    super(message, 502, "delivery");
    this.name = "EmailDeliveryError";
  }
}

