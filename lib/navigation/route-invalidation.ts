import { revalidatePath } from "next/cache";

const uniquePaths = (paths: string[]): string[] => Array.from(new Set(paths.filter(Boolean)));

export function revalidatePaths(paths: string[]): void {
  for (const path of uniquePaths(paths)) {
    revalidatePath(path);
  }
}

export function getClassroomRoomPaths(classId: string): string[] {
  return [`/classes/${classId}/room`, `/my-classes/${classId}/room`];
}

export function getAssessmentResultsPaths(assessmentId: string): string[] {
  return [`/assessments/${assessmentId}/results`];
}

export function getCourseAssessmentPublicationPaths(courseId: string): string[] {
  return [`/courses/${courseId}/results`];
}

export function getStudentAssessmentPaths(assessmentId: string): string[] {
  return [`/my-classes/assessments/${assessmentId}`];
}

export function getClassListPaths(): string[] {
  return ["/classes", "/my-classes"];
}

export function getDashboardPaths(): string[] {
  return ["/dashboard"];
}

export function getLibraryPaths(): string[] {
  return ["/library", "/materials"];
}
