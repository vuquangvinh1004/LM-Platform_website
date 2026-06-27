import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const users = [
  {
    alias: "Mod123",
    email: "mod123@local.test",
    password: "Mod123",
    fullName: "Local Moderator",
    role: "moderator",
    teacherCode: null,
    studentCode: null,
  },
  {
    alias: "Lec123",
    email: "lec123@local.test",
    password: "Lec123",
    fullName: "Local Lecturer",
    role: "teacher",
    teacherCode: "LEC123",
    studentCode: null,
  },
  {
    alias: "Stu123",
    email: "stu123@local.test",
    password: "Stu123",
    fullName: "Local Student",
    role: "student",
    teacherCode: null,
    studentCode: "STU123",
  },
  {
    alias: "Stu321",
    email: "stu321@local.test",
    password: "Stu321",
    fullName: "Local Student 321",
    role: "student",
    teacherCode: null,
    studentCode: "STU321",
  },
];

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    throw error;
  }

  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

for (const user of users) {
  let authUser = await findUserByEmail(user.email);

  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      app_metadata: {
        role: user.role,
      },
      user_metadata: {
        role: user.role,
        full_name: user.fullName,
      },
    });

    if (error) {
      throw error;
    }

    authUser = data.user;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password: user.password,
      email_confirm: true,
      app_metadata: {
        ...authUser.app_metadata,
        role: user.role,
      },
      user_metadata: {
        ...authUser.user_metadata,
        role: user.role,
        full_name: user.fullName,
      },
    });

    if (error) {
      throw error;
    }
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: authUser.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      status: "active",
      access_status: "active",
      access_expires_at: null,
      teacher_code: user.teacherCode,
      student_code: user.studentCode,
      approved_by: null,
      approved_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw profileError;
  }

  console.log(`[bootstrap] ${user.alias}/${user.password} -> ${user.email} (${user.role})`);
}
