from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_db, require_superadmin
from app.db.models import (
    DEFAULT_ENVIRONMENTS,
    Environment,
    EnvironmentEnum,
    Project,
    ProjectMember,
    RoleEnum,
    User,
)
from app.schemas.project import (
    EnvironmentOut,
    EnvironmentUpdate,
    MemberAdd,
    MemberOut,
    MemberRoleUpdate,
    ProjectCreate,
    ProjectListItem,
    ProjectOut,
    ProjectUpdate,
)

router = APIRouter()


def _get_membership(db: Session, project_id: str, user: User) -> ProjectMember | None:
    return (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id)
        .first()
    )


def _require_project_admin(db: Session, project_id: str, user: User) -> ProjectMember:
    """User must be project admin or superadmin."""
    if user.is_superadmin:
        mem = _get_membership(db, project_id, user)
        if mem:
            return mem
        dummy = ProjectMember(project_id=project_id, user_id=user.id, role=RoleEnum.admin)
        return dummy
    mem = _get_membership(db, project_id, user)
    if not mem or mem.role != RoleEnum.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project admin privileges required")
    return mem


# --- Project CRUD ---

@router.get("", response_model=list[ProjectListItem])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_superadmin:
        projects = db.query(Project).all()
        result = []
        for p in projects:
            mem = _get_membership(db, p.id, current_user)
            result.append(ProjectListItem(
                id=p.id, name=p.name, description=p.description,
                role=mem.role if mem else "admin",
                created_at=p.created_at,
            ))
        return result

    memberships = (
        db.query(ProjectMember)
        .filter(ProjectMember.user_id == current_user.id)
        .options(joinedload(ProjectMember.project))
        .all()
    )
    return [
        ProjectListItem(
            id=m.project.id, name=m.project.name, description=m.project.description,
            role=m.role, created_at=m.project.created_at,
        )
        for m in memberships
    ]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    project = Project(name=body.name, description=body.description)
    db.add(project)
    db.flush()

    for slug, label in DEFAULT_ENVIRONMENTS:
        db.add(Environment(project_id=project.id, slug=slug, label=label))

    db.add(ProjectMember(project_id=project.id, user_id=current_user.id, role=RoleEnum.admin))

    db.commit()
    return _load_project(db, project.id)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_superadmin:
        mem = _get_membership(db, project_id, current_user)
        if not mem:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this project")
    return _load_project(db, project_id)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_project_admin(db, project_id, current_user)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    db.commit()
    return _load_project(db, project_id)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: str,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    db.delete(project)
    db.commit()


# --- Environments ---


@router.patch("/{project_id}/environments/{environment_id}", response_model=EnvironmentOut)
def update_environment(
    project_id: str,
    environment_id: str,
    body: EnvironmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_project_admin(db, project_id, current_user)
    env = (
        db.query(Environment)
        .filter(Environment.id == environment_id, Environment.project_id == project_id)
        .first()
    )
    if not env:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Environment not found")
    if body.label is not None:
        env.label = body.label
    if body.base_url is not None:
        env.base_url = body.base_url or None
    db.commit()
    db.refresh(env)
    slug_val = env.slug.value if isinstance(env.slug, EnvironmentEnum) else str(env.slug)
    return EnvironmentOut(id=env.id, slug=slug_val, label=env.label, base_url=env.base_url)


# --- Member management ---

@router.get("/{project_id}/members", response_model=list[MemberOut])
def list_members(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_superadmin:
        mem = _get_membership(db, project_id, current_user)
        if not mem:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this project")

    members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .options(joinedload(ProjectMember.user))
        .all()
    )
    return [
        MemberOut(
            id=m.id, user_id=m.user_id, email=m.user.email,
            display_name=m.user.display_name, role=m.role,
            created_at=m.created_at,
        )
        for m in members
    ]


@router.post("/{project_id}/members", response_model=MemberOut, status_code=201)
def add_member(
    project_id: str,
    body: MemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_project_admin(db, project_id, current_user)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    target_user = db.query(User).filter(User.email == body.email).first()
    if not target_user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User with this email not found")

    existing = _get_membership(db, project_id, target_user)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "User is already a member")

    role = RoleEnum(body.role) if body.role in RoleEnum.__members__ else RoleEnum.member
    mem = ProjectMember(project_id=project_id, user_id=target_user.id, role=role)
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return MemberOut(
        id=mem.id, user_id=target_user.id, email=target_user.email,
        display_name=target_user.display_name, role=mem.role,
        created_at=mem.created_at,
    )


@router.patch("/{project_id}/members/{member_id}", response_model=MemberOut)
def update_member_role(
    project_id: str,
    member_id: str,
    body: MemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_project_admin(db, project_id, current_user)
    mem = db.query(ProjectMember).filter(ProjectMember.id == member_id, ProjectMember.project_id == project_id).first()
    if not mem:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    mem.role = RoleEnum(body.role) if body.role in RoleEnum.__members__ else RoleEnum.member
    db.commit()
    db.refresh(mem)
    user = db.query(User).filter(User.id == mem.user_id).first()
    return MemberOut(
        id=mem.id, user_id=mem.user_id, email=user.email,
        display_name=user.display_name, role=mem.role,
        created_at=mem.created_at,
    )


@router.delete("/{project_id}/members/{member_id}", status_code=204)
def remove_member(
    project_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_project_admin(db, project_id, current_user)
    mem = db.query(ProjectMember).filter(ProjectMember.id == member_id, ProjectMember.project_id == project_id).first()
    if not mem:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    db.delete(mem)
    db.commit()


def _load_project(db: Session, project_id: str) -> ProjectOut:
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .options(joinedload(Project.environments), joinedload(Project.members).joinedload(ProjectMember.user))
        .first()
    )
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        updated_at=project.updated_at,
        environments=[
            {"id": e.id, "slug": e.slug, "label": e.label, "base_url": e.base_url}
            for e in project.environments
        ],
        members=[
            {
                "id": m.id, "user_id": m.user_id, "email": m.user.email,
                "display_name": m.user.display_name, "role": m.role,
                "created_at": m.created_at,
            }
            for m in project.members
        ],
    )
