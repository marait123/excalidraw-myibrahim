import dynamic from "next/dynamic";

import Credit from "../credit";

import "../common.scss";

// Since client components get prerenderd on server as well hence importing the excalidraw stuff dynamically
// with ssr false
const Excalidraw = dynamic(
  async () => (await import("../excalidrawWrapper")).default,
  {
    ssr: false,
  },
);

export default function Page() {
  return (
    <>
      <a href="/">Switch to App router</a>
      <h1 className="page-title">Pages Router</h1>
      <Credit />
      {/* @ts-expect-error - https://github.com/vercel/next.js/issues/42292 */}
      <Excalidraw />
    </>
  );
}
