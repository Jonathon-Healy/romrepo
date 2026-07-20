import json
from datetime import datetime, timezone

from sqlalchemy import (Boolean, Column, DateTime, Float, ForeignKey, Integer,
                        String, Text, UniqueConstraint)
from sqlalchemy.orm import relationship

from .database import Base

ALL_PERMISSIONS = [
    "library.view",
    "library.download",
    "scan.run",
    "users.manage",
    "roles.manage",
    "settings.manage",
]


def utcnow():
    return datetime.now(timezone.utc)


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    permissions_json = Column(Text, default="[]")
    builtin = Column(Boolean, default=False)
    users = relationship("User", back_populates="role")

    @property
    def permissions(self):
        return json.loads(self.permissions_json or "[]")

    @permissions.setter
    def permissions(self, perms):
        self.permissions_json = json.dumps(sorted(set(perms) & set(ALL_PERMISSIONS)))


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False)
    disabled = Column(Boolean, default=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)
    role = relationship("Role", back_populates="users")

    @property
    def permissions(self):
        return self.role.permissions if self.role else []


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (UniqueConstraint("path", name="uq_game_path"),)
    id = Column(Integer, primary_key=True)
    path = Column(String, nullable=False)  # relative to ROMS_PATH
    filename = Column(String, nullable=False)
    platform = Column(String, nullable=False, index=True)  # slug
    size = Column(Integer, default=0)
    name = Column(String, nullable=False, index=True)  # cleaned display name
    igdb_id = Column(Integer, nullable=True)
    summary = Column(Text, nullable=True)
    release_year = Column(Integer, nullable=True)
    genres = Column(String, nullable=True)  # comma separated
    rating = Column(Float, nullable=True)
    cover_file = Column(String, nullable=True)  # file in ART_PATH
    screenshots_json = Column(Text, default="[]")
    matched = Column(Boolean, default=False)
    match_failed = Column(Boolean, default=False)
    added_at = Column(DateTime, default=utcnow)

    @property
    def screenshots(self):
        return json.loads(self.screenshots_json or "[]")


class Favorite(Base):
    __tablename__ = "favorites"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    game_id = Column(Integer, ForeignKey("games.id"), primary_key=True)


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)


def get_setting(db, key, default=None):
    row = db.get(Setting, key)
    return row.value if row and row.value is not None else default


def set_setting(db, key, value):
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.commit()
