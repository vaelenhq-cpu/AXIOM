from pydantic import Field

from .common import APIModel


class DriverLoginRequest(APIModel):
    company_slug: str = Field(
        min_length=1,
        max_length=120,
    )

    login_identifier: str = Field(
        min_length=1,
        max_length=200,
    )

    password: str = Field(
        min_length=8,
        max_length=256,
    )


class DriverOperationIssueRequest(APIModel):
    issue_type: str = Field(
        min_length=1,
        max_length=50,
    )

    description: str = Field(
        min_length=1,
        max_length=1000,
    )



class DriverOperationEventRequest(APIModel):
    event_type: str = Field(
        min_length=1,
        max_length=80,
    )

    description: str | None = Field(
        default=None,
        max_length=1000,
    )
