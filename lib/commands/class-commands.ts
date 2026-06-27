import {
  addStudentsToClass,
  createClass,
  createClassLifecycleRequest,
  importStudentsToClass,
  reviewClassChangeRequest,
} from "@/lib/services/class-service";
import { createTemplateClass, deleteClassTemplate } from "@/lib/services/classroom-service";
import { reviewEnrollmentRequest } from "@/lib/services/enrollment-service";

export async function createClassCommand(input: Parameters<typeof createClass>[0]) {
  return createClass(input);
}

export async function createClassLifecycleRequestCommand(input: Parameters<typeof createClassLifecycleRequest>[0]) {
  return createClassLifecycleRequest(input);
}

export async function reviewClassChangeRequestCommand(input: Parameters<typeof reviewClassChangeRequest>[0]) {
  return reviewClassChangeRequest(input);
}

export async function reviewEnrollmentRequestCommand(input: Parameters<typeof reviewEnrollmentRequest>[0]) {
  return reviewEnrollmentRequest(input);
}

export async function addStudentsToClassCommand(input: Parameters<typeof addStudentsToClass>[0]) {
  return addStudentsToClass(input);
}

export async function importStudentsToClassCommand(input: Parameters<typeof importStudentsToClass>[0]) {
  return importStudentsToClass(input);
}

export async function deleteClassTemplateCommand(input: Parameters<typeof deleteClassTemplate>[0]) {
  return deleteClassTemplate(input);
}

export async function createTemplateClassCommand(input: Parameters<typeof createTemplateClass>[0]) {
  return createTemplateClass(input);
}
