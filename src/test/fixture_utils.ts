import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const createTestTmpdir = async (
  prefix: string,
  {
    root = os.tmpdir(),
  }: {
    root?: string | undefined;
  } = {},
): Promise<[path: string, cleanup: () => Promise<void>]> => {
  if (!path.isAbsolute(root)) {
    throw new Error(`${root} must be an absolute path. Received: ${root}`);
  }
  const tmpdir = await fs.mkdtemp(path.join(root, `${prefix}-`));
  await fs.mkdir(path.join(tmpdir, ".git"));

  return [
    tmpdir,
    async () => {
      await fs.rm(tmpdir, { recursive: true, force: true });
    },
  ];
};

export const createInitializeFixture =
  (
    fixturesRoot: string,
    tmpdirPrefix: string,
    { tmpdirRoot }: { tmpdirRoot?: string | undefined } = {},
  ): ((fixture: string) => ReturnType<typeof createTestTmpdir>) =>
  async (fixture) => {
    const fixturePath = path.join(fixturesRoot, fixture);

    try {
      const result = await fs.stat(fixturePath);
      if (!result.isDirectory()) {
        throw new Error("Path exists, but is not a directory");
      }
    } catch (err) {
      throw new Error(
        `Fixture at "${fixturePath}" does not exist or is not a directory.`,
        { cause: err },
      );
    }

    // TODO(ndhoule): Check if `fixture` is a resolvable directory
    const [tmpdir, cleanupTmpdir] = await createTestTmpdir(tmpdirPrefix, {
      root: tmpdirRoot,
    });
    await fs.cp(path.join(fixturesRoot, fixture), tmpdir, { recursive: true });

    return [tmpdir, cleanupTmpdir];
  };
