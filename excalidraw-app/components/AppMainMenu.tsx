import {
  eyeIcon,
  LibraryIcon,
  ExternalLinkIcon,
  presentationIcon,
  boltIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import { useAtomValue } from "../app-jotai";
import { presentationAPIAtom } from "../presentation/usePresentation";
import { openWhatsNew } from "../whats-new/whatsNew";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
  activeProjectName: string | null;
  onOpenProjects: () => void;
}> = React.memo((props) => {
  const { t } = useI18n();
  const presentation = useAtomValue(presentationAPIAtom);
  return (
    <MainMenu>
      {props.activeProjectName && (
        <MainMenu.ItemCustom>
          <div
            title={props.activeProjectName}
            style={{
              padding: "0.25rem 0",
              fontWeight: 600,
              fontSize: "0.8125rem",
              opacity: 0.7,
              width: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {props.activeProjectName}
          </div>
        </MainMenu.ItemCustom>
      )}
      <MainMenu.Item icon={LibraryIcon} onSelect={props.onOpenProjects}>
        {t("projectsDialog.title")}
      </MainMenu.Item>
      <MainMenu.Item
        icon={presentationIcon}
        onSelect={() => presentation?.start(0)}
      >
        {t("presentation.present")}
      </MainMenu.Item>
      <MainMenu.Separator />
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.Item icon={boltIcon} onSelect={openWhatsNew}>
        {t("whatsNew.title")}
      </MainMenu.Item>
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Socials />
      <MainMenu.ItemLink
        icon={ExternalLinkIcon}
        href="https://myibrahim.cloud/"
        className=""
      >
        Developed by myibrahim.cloud
      </MainMenu.ItemLink>
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
