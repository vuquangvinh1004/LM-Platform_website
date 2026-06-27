import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function listAllObjectPaths(bucket, prefix = "") {
  const paths = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const entry of data) {
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        paths.push(...(await listAllObjectPaths(bucket, entryPath)));
      } else {
        paths.push(entryPath);
      }
    }

    if (data.length < limit) {
      break;
    }

    offset += data.length;
  }

  return paths;
}

async function removeInChunks(bucket, objectPaths, chunkSize = 100) {
  let removedCount = 0;

  for (let index = 0; index < objectPaths.length; index += chunkSize) {
    const chunk = objectPaths.slice(index, index + chunkSize);
    const { error } = await supabase.storage.from(bucket).remove(chunk);

    if (error) {
      throw error;
    }

    removedCount += chunk.length;
  }

  return removedCount;
}

async function main() {
  const courseMaterialPaths = (await listAllObjectPaths("course-materials")).filter((path) => !path.startsWith("personal/"));
  const simulationPackagePaths = await listAllObjectPaths("simulation-packages");

  const removedCourseMaterials = await removeInChunks("course-materials", courseMaterialPaths);
  const removedSimulationPackages = await removeInChunks("simulation-packages", simulationPackagePaths);

  console.log(
    JSON.stringify(
      {
        removedCourseMaterials,
        removedSimulationPackages,
        keptPersonalCourseMaterials: (await listAllObjectPaths("course-materials")).filter((path) => path.startsWith("personal/")).length,
      },
      null,
      2,
    ),
  );
}

await main();
