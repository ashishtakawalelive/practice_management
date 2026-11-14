import Link from "next/link";
import { getProject } from "@/lib/projects";
import { ProjectTabs } from "./tabs";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { project } = await getProject(key);
  return (
    <>
      <div className="mb-4">
        <div className="mb-1 text-xs text-muted">
          <Link href="/projects" className="hover:underline">
            Projects
          </Link>{" "}
          / <span className="font-mono">{project.key}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
            <p className="text-sm text-muted">
              {project.client ? (
                <Link href={`/clients/${project.client.id}`} className="hover:underline">
                  {project.client.name}
                </Link>
              ) : (
                "Internal / multiple clients"
              )}
              {project.lead && <> · Lead: {project.lead.name}</>}
            </p>
          </div>
        </div>
        <ProjectTabs projectKey={project.key} />
      </div>
      {children}
    </>
  );
}
