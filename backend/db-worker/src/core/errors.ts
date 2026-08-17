export class AxiomError extends Error {
  constructor(
    message: string,
    public code = "AXIOM_ERROR",
  ) {
    super(message);
  }
}

export class NotFoundError extends AxiomError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}

export class ValidationError extends AxiomError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

export class PermissionError extends AxiomError {
  constructor(message: string) {
    super(message, "PERMISSION_DENIED");
  }
}
