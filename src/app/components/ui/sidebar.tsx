"use client";

// Public entry point for the Sidebar UI library. Re-exports the historical
// public surface; the implementation lives in the ./sidebar/ modules
// (context, sidebar, primitives, menu).

export { SidebarProvider, useSidebar } from "./sidebar/context";
export { Sidebar, SidebarInset, SidebarRail, SidebarTrigger } from "./sidebar/sidebar";
export {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarSeparator,
} from "./sidebar/primitives";
export {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "./sidebar/menu";
