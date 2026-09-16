import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          <EncryptedIcon />
          <a
            href="https://myibrahim.cloud/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.75rem",
              color: "var(--color-gray-60)",
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
          >
            Developed by myibrahim.cloud
          </a>
        </div>
      </Footer>
    );
  },
);
