---
version: alpha
name: Learning Management Platform (LMP)
description: "Learning management hub for teachers with clean, trusted academic UI"
colors:
  primary: "#0f766e"
  secondary: "#0369a1"
  neutral: "#f8fafc"
  on-primary: "#f8fafc"
  on-neutral: "#0f172a"
  error: "#b91c1c"
  success: "#166534"
typography:
  h1:
    fontFamily: "Be Vietnam Pro"
    fontSize: "2rem"
    fontWeight: "700"
  body-md:
    fontFamily: "Be Vietnam Pro"
    fontSize: "1rem"
    fontWeight: "400"
  label-sm:
    fontFamily: "Be Vietnam Pro"
    fontSize: "0.875rem"
    fontWeight: "500"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "#115e59"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  badge-active:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  badge-archived:
    backgroundColor: "#cbd5e1"
    textColor: "#1e293b"
    rounded: "{rounded.sm}"
  surface-default:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-neutral}"
    rounded: "{rounded.lg}"
  back-text-link:
    textColor: "{colors.secondary}"
    icon: "left-arrow"
    placement: "top-left-before-page-title"
    usage: "Dùng để quay về trang cha hoặc trang trước; không hiển thị như button viền."
---

# Overview

LMP follows a focused visual language for teachers and students. The interface should feel reliable, calm, and easy to scan, with Vietnamese-first content and clear state signaling for active or archived entities.

Điều hướng quay lại dùng link text màu xanh kèm mũi tên trái, đặt ở góc trái trên cùng của trang trước tiêu đề/header chính. Dùng component chung `BackTextLink` cho tất cả link quay lại mới.
