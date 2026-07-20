import enum


class RoleName(str, enum.Enum):
    CLIENT = "client"
    CASE_OFFICER = "case_officer"
    REVIEWER = "reviewer"
    FINANCE = "finance"
    ADMIN = "admin"


STAFF_ROLES = {RoleName.CASE_OFFICER, RoleName.REVIEWER, RoleName.FINANCE, RoleName.ADMIN}
