class AuthenticationError(Exception):
    pass


class InvalidCredentials(AuthenticationError):
    pass


class SessionExpired(AuthenticationError):
    pass


class SessionRevoked(AuthenticationError):
    pass


class PermissionDenied(AuthenticationError):
    pass


class AccountDisabled(AuthenticationError):
    pass
