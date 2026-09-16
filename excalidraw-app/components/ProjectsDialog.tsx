import { useEffect, useState } from "react";
import clsx from "clsx";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import {
  PlusIcon,
  TrashIcon,
  LibraryIcon,
  checkIcon,
  pencilIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { KEYS } from "@excalidraw/common";

import { useAtom } from "../app-jotai";
import {
  ProjectsStorage,
  activeProjectAtom,
  type ProjectMetadata,
} from "../data/projects";

import "./ProjectsDialog.scss";

type ProjectsDialogProps = {
  onClose: () => void;
  onOpenProject: (id: string) => void;
  onCreateProject: (name: string) => void;
};

export const ProjectsDialog = (props: ProjectsDialogProps) => {
  const { t } = useI18n();
  const [activeProject] = useAtom(activeProjectAtom);
  const [projects, setProjects] = useState<ProjectMetadata[] | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = () => {
    ProjectsStorage.listProjects().then(setProjects);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = () => {
    props.onCreateProject(t("projectsDialog.untitled"));
    props.onClose();
  };

  const handleOpen = (id: string) => {
    if (id !== activeProject?.id) {
      props.onOpenProject(id);
    }
    props.onClose();
  };

  const startRename = (project: ProjectMetadata) => {
    setConfirmDeleteId(null);
    setRenamingId(project.id);
    setRenameValue(project.name);
  };

  const commitRename = async (id: string) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) {
      return;
    }
    await ProjectsStorage.renameProject(id, name);
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    await ProjectsStorage.deleteProject(id);

    if (id === activeProject?.id) {
      const remaining = await ProjectsStorage.listProjects();
      if (remaining.length > 0) {
        props.onOpenProject(remaining[0].id);
      } else {
        props.onCreateProject(t("projectsDialog.untitled"));
      }
    }
    refresh();
  };

  return (
    <Dialog
      size="small"
      onCloseRequest={props.onClose}
      title={t("projectsDialog.title")}
    >
      <div className="ProjectsDialog">
        <FilledButton
          size="large"
          icon={PlusIcon}
          label={t("projectsDialog.newProject")}
          onClick={handleCreate}
          className="ProjectsDialog__newButton"
        />
        <div className="ProjectsDialog__list">
          {projects === null && (
            <div className="ProjectsDialog__empty">
              {t("projectsDialog.loading")}
            </div>
          )}
          {projects?.length === 0 && (
            <div className="ProjectsDialog__empty">
              {t("projectsDialog.empty")}
            </div>
          )}
          {projects?.map((project) => {
            const isActive = project.id === activeProject?.id;
            const isRenaming = renamingId === project.id;
            return (
              <div
                key={project.id}
                className={clsx("ProjectsDialog__row", {
                  "ProjectsDialog__row--active": isActive,
                })}
                onClick={() => !isRenaming && handleOpen(project.id)}
              >
                <div className="ProjectsDialog__rowIcon">{LibraryIcon}</div>
                {isRenaming ? (
                  <div
                    className="ProjectsDialog__rename"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <TextField
                      value={renameValue}
                      onChange={setRenameValue}
                      selectOnRender
                      onKeyDown={(event) => {
                        if (event.key === KEYS.ENTER) {
                          commitRename(project.id);
                        } else if (event.key === KEYS.ESCAPE) {
                          setRenamingId(null);
                        }
                      }}
                    />
                    <FilledButton
                      size="medium"
                      label={t("buttons.confirm")}
                      onClick={() => commitRename(project.id)}
                    />
                  </div>
                ) : (
                  <div className="ProjectsDialog__rowInfo">
                    <div className="ProjectsDialog__rowName">
                      <span>{project.name}</span>
                      {isActive && (
                        <span className="ProjectsDialog__rowBadge">
                          {checkIcon}
                          {t("projectsDialog.current")}
                        </span>
                      )}
                    </div>
                    <div className="ProjectsDialog__rowMeta">
                      {t("projectsDialog.updated")}{" "}
                      {new Date(project.updatedAt).toLocaleString()}
                    </div>
                  </div>
                )}
                {!isRenaming && (
                  <div className="ProjectsDialog__rowActions">
                    <button
                      type="button"
                      className="ProjectsDialog__iconButton"
                      title={t("projectsDialog.rename")}
                      onClick={(event) => {
                        event.stopPropagation();
                        startRename(project);
                      }}
                    >
                      {pencilIcon}
                    </button>
                    <button
                      type="button"
                      className={clsx("ProjectsDialog__iconButton", {
                        "ProjectsDialog__iconButton--danger":
                          confirmDeleteId === project.id,
                      })}
                      title={
                        confirmDeleteId === project.id
                          ? t("projectsDialog.confirmDelete")
                          : t("projectsDialog.delete")
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(project.id);
                      }}
                    >
                      {TrashIcon}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
};
