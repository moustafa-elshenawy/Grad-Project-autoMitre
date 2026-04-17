import datetime
from sqlalchemy import Column, String, Float, Integer, ForeignKey, Text, JSON, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from database.config import Base
import uuid


# ── Team Groups ───────────────────────────────────────────────────────────────

class Group(Base):
    __tablename__ = "groups"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(String, default=lambda: datetime.datetime.utcnow().isoformat())

    owner = relationship("User", foreign_keys=[owner_id])
    memberships = relationship("GroupMembership", back_populates="group", cascade="all, delete")
    invitations = relationship("GroupInvitation", back_populates="group", cascade="all, delete")


class GroupMembership(Base):
    __tablename__ = "group_memberships"
    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_group_user"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String, ForeignKey("groups.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="analyst")   # admin | analyst
    joined_at = Column(String, default=lambda: datetime.datetime.utcnow().isoformat())

    group = relationship("Group", back_populates="memberships")
    user = relationship("User")


class GroupInvitation(Base):
    __tablename__ = "group_invitations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = Column(String, ForeignKey("groups.id"), nullable=False)
    inviter_id = Column(String, ForeignKey("users.id"), nullable=False)
    invitee_id = Column(String, ForeignKey("users.id"), nullable=True)          # resolved once found
    invitee_identifier = Column(String, nullable=False)  # username or email typed by admin
    status = Column(String, default="pending")  # pending | accepted | denied
    created_at = Column(String, default=lambda: datetime.datetime.utcnow().isoformat())

    group = relationship("Group", back_populates="invitations")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    # Profile fields
    full_name = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    role = Column(String, nullable=True, default="analyst")        # analyst, admin, viewer
    organization = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)

    # Timestamps
    created_at = Column(String, default=lambda: datetime.datetime.utcnow().isoformat())
    last_login_at = Column(String, nullable=True)


class ThreatRecord(Base):
    __tablename__ = "threat_records"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=True)
    group_id = Column(String, ForeignKey("groups.id"), index=True, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    input_type = Column(String, nullable=False)
    
    # Risk Score flatten
    risk_score = Column(Float, nullable=False)
    severity = Column(String, nullable=False)
    likelihood = Column(Float, nullable=False)
    impact_score = Column(Float, nullable=False)
    business_impact = Column(Text, nullable=False)
    
    # Raw data stored as JSON to avoid excessive tables for simple lists
    raw_indicators = Column(JSON, default={})
    
    # We store the pre-mapped framework coverage counts for dashboard speed
    framework_coverage_attack = Column(Integer, default=0)
    framework_coverage_defend = Column(Integer, default=0)
    framework_coverage_nist = Column(Integer, default=0)
    framework_coverage_owasp = Column(Integer, default=0)

    timestamp = Column(String, default=lambda: datetime.datetime.utcnow().isoformat())
    
    # Framework mappings stored as JSON
    defend_json = Column(JSON, default=list)
    nist_json = Column(JSON, default=list)
    owasp_json = Column(JSON, default=list)

    # Relationships
    entities = relationship("ThreatEntity", back_populates="threat", cascade="all, delete")
    techniques = relationship("ThreatTechnique", back_populates="threat", cascade="all, delete")
    mitigations = relationship("ThreatMitigation", back_populates="threat", cascade="all, delete")
    predicted_steps = relationship("ThreatPredictedStep", back_populates="threat", cascade="all, delete")


class ThreatEntity(Base):
    __tablename__ = "threat_entities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    threat_id = Column(String, ForeignKey("threat_records.id"), nullable=False)
    type = Column(String, nullable=False)
    value = Column(String, nullable=False)
    context = Column(String, nullable=True)

    threat = relationship("ThreatRecord", back_populates="entities")


class ThreatTechnique(Base):
    __tablename__ = "threat_techniques"

    id = Column(Integer, primary_key=True, autoincrement=True)
    threat_id = Column(String, ForeignKey("threat_records.id"), nullable=False)
    technique_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    tactic = Column(String, nullable=False)
    tactic_id = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False)
    verified = Column(Boolean, default=False)
    evidence = Column(JSON, default=list)

    threat = relationship("ThreatRecord", back_populates="techniques")


class ThreatMitigation(Base):
    __tablename__ = "threat_mitigations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    threat_id = Column(String, ForeignKey("threat_records.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String, nullable=False)
    effort = Column(String, nullable=False)
    iac_snippet = Column(Text, nullable=True)
    iac_type = Column(String, nullable=True)

    threat = relationship("ThreatRecord", back_populates="mitigations")


class ThreatPredictedStep(Base):
    __tablename__ = "threat_predicted_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    threat_id = Column(String, ForeignKey("threat_records.id"), nullable=False)
    step_id = Column(Integer, nullable=True) # The order/index
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False)

    threat = relationship("ThreatRecord", back_populates="predicted_steps")


class OSINTFeedItem(Base):
    """Stores external threat intelligence feeds identically to the frontend."""
    __tablename__ = "osint_feed_items"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    technique = Column(String, nullable=True)
    tactic = Column(String, nullable=True)
    timestamp = Column(String, nullable=False)
    source = Column(String, nullable=False)
    source_key = Column(String, nullable=False)
    iocs = Column(JSON, default=list)
    frameworks = Column(JSON, default=list)
    tags = Column(JSON, default=list)
    description = Column(Text, nullable=True)
    external_url = Column(String, nullable=True)
    
    # Internal usage tracker
    created_at = Column(String, default=lambda: datetime.datetime.utcnow().isoformat())


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditLog(Base):
    """
    System-wide audit trail.
    Captures every significant action: auth, analysis, exports, settings, team ops.
    """
    __tablename__ = "audit_logs"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category    = Column(String, nullable=False, index=True)   # AUTH | ANALYSIS | EXPORT | SETTINGS | USER | TEAM | ADMIN | THREAT
    action      = Column(String, nullable=False)                # e.g. "login_success", "export_stix"
    user_id     = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    username    = Column(String, nullable=True)                 # denormalized for fast display
    ip_address  = Column(String, nullable=True)
    status      = Column(String, nullable=False, default="success")  # success | failure | warning
    details     = Column(JSON, default=dict)                   # free-form context payload
    timestamp   = Column(String, nullable=False, index=True, default=lambda: datetime.datetime.utcnow().isoformat())
