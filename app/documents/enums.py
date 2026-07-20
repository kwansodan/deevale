import enum


class DocumentTypeCode(str, enum.Enum):
    PASSPORT = "passport"
    GHANA_CARD = "ghana_card"
    PROOF_OF_ADDRESS = "proof_of_address"
    NAME_RESERVATION_CERTIFICATE = "name_reservation_certificate"
    CERTIFICATE_OF_INCORPORATION = "certificate_of_incorporation"
    FORM_3 = "form_3"
    CONSTITUTION = "constitution"
    TIN_CERTIFICATE = "tin_certificate"
    SSNIT_CERTIFICATE = "ssnit_certificate"
    BUSINESS_OPERATING_PERMIT = "business_operating_permit"
    # GIPC / foreign participation
    PROOF_OF_EQUITY = "proof_of_equity"
    BENEFICIAL_OWNERSHIP_PROFILE = "beneficial_ownership_profile"
    GIPC_FORMS = "gipc_forms"
    GIPC_CERTIFICATE = "gipc_certificate"
    # Partnership / CLG / external company
    PARTNERSHIP_DEED = "partnership_deed"
    PARTNERSHIP_CERTIFICATE = "partnership_certificate"
    CLG_CERTIFICATE = "clg_certificate"
    EXECUTIVE_COUNCIL_IDS = "executive_council_ids"
    NOTARIZED_HOME_INCORPORATION = "notarized_home_incorporation"
    NOTARIZED_HOME_CONSTITUTION = "notarized_home_constitution"
    POWER_OF_ATTORNEY = "power_of_attorney"
    EXTERNAL_COMPANY_CERTIFICATE = "external_company_certificate"
    OTHER = "other"


VAULT_DOCUMENT_TYPES = {
    DocumentTypeCode.CERTIFICATE_OF_INCORPORATION,
    DocumentTypeCode.FORM_3,
    DocumentTypeCode.CONSTITUTION,
    DocumentTypeCode.TIN_CERTIFICATE,
    DocumentTypeCode.SSNIT_CERTIFICATE,
    DocumentTypeCode.BUSINESS_OPERATING_PERMIT,
    DocumentTypeCode.GIPC_CERTIFICATE,
    DocumentTypeCode.PARTNERSHIP_CERTIFICATE,
    DocumentTypeCode.CLG_CERTIFICATE,
    DocumentTypeCode.EXTERNAL_COMPANY_CERTIFICATE,
}


class UploadStatus(str, enum.Enum):
    PENDING = "pending"
    UPLOADED = "uploaded"
    FAILED = "failed"


class ReviewStatus(str, enum.Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReviewReasonCode(str, enum.Enum):
    ILLEGIBLE = "illegible"
    EXPIRED = "expired"
    NAME_MISMATCH = "name_mismatch"
    INCOMPLETE = "incomplete"
    WRONG_DOCUMENT = "wrong_document"


class VirusScanStatus(str, enum.Enum):
    PENDING = "pending"
    CLEAN = "clean"
    FLAGGED = "flagged"
