"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import {
  EquipmentIcon,
  LaboratoryIcon,
  MapPinIcon,
  RoomIcon,
} from "@/components/icons";
import { LogoutButton } from "@/features/auth/components/logout-button";
import type { User } from "@/features/auth/types";
import {
  createResource,
  createResourceClosure,
  deleteResourceClosure,
  getResourceClosures,
  ResourceMutationError,
  updateResource,
  updateResourceStatus,
} from "../api/browser";
import type {
  Building,
  Resource,
  ResourceClosure,
  ResourceInput,
  ResourceStatus,
  ResourceType,
} from "../types";
import styles from "./admin-resource-manager.module.css";

const resourceTypes: { value: ResourceType; label: string }[] = [
  { value: "room", label: "Room" },
  { value: "laboratory", label: "Laboratory" },
  { value: "equipment", label: "Equipment" },
];

const statusLabels: Record<ResourceStatus, string> = {
  active: "Active",
  maintenance: "Maintenance",
  inactive: "Inactive",
};

const operatingDayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];
const HOUR_PATTERN = /^(?:[01]\d|2[0-3]):00$/;

interface FormState {
  code: string;
  name: string;
  description: string;
  type: ResourceType;
  capacity: string;
  location: string;
  amenities: string;
  requiresApproval: boolean;
  operatingDays: number[];
  opensAt: string;
  closesAt: string;
  buildingId: string;
}

interface FormErrors {
  code?: string;
  name?: string;
  capacity?: string;
  location?: string;
  buildingId?: string;
  amenities?: string;
  operatingDays?: string;
  opensAt?: string;
  closesAt?: string;
}

function emptyForm(buildings: Building[]): FormState {
  return {
    code: "",
    name: "",
    description: "",
    type: "room",
    capacity: "1",
    location: "",
    amenities: "",
    requiresApproval: false,
    operatingDays: [1, 2, 3, 4, 5, 6],
    opensAt: "08:00",
    closesAt: "18:00",
    buildingId: buildings[0]?.id ?? "",
  };
}

function formFor(resource: Resource): FormState {
  return {
    code: resource.code,
    name: resource.name,
    description: resource.description ?? "",
    type: resource.type,
    capacity: String(resource.capacity),
    location: resource.location,
    amenities: resource.amenities.join(", "),
    requiresApproval: resource.requiresApproval,
    operatingDays: resource.operatingDays,
    opensAt: resource.opensAt,
    closesAt: resource.closesAt,
    buildingId: resource.building.id,
  };
}

function iconFor(type: ResourceType) {
  if (type === "laboratory") return LaboratoryIcon;
  if (type === "equipment") return EquipmentIcon;
  return RoomIcon;
}

function parseAmenities(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const code = form.code.trim();
  if (
    code.length < 2 ||
    code.length > 30 ||
    !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(code)
  ) {
    errors.code = "Use 2–30 letters, numbers, and single hyphens.";
  }
  if (form.name.trim().length < 2) errors.name = "Enter a resource name.";
  const capacity = Number(form.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
    errors.capacity = "Enter a whole number from 1 to 10,000.";
  }
  if (form.location.trim().length < 2) errors.location = "Enter a location.";
  if (!form.buildingId) errors.buildingId = "Choose a building.";
  if (form.operatingDays.length === 0) {
    errors.operatingDays = "Select at least one operating day.";
  }
  if (!HOUR_PATTERN.test(form.opensAt)) {
    errors.opensAt = "Choose a whole-hour opening time.";
  }
  if (!HOUR_PATTERN.test(form.closesAt)) {
    errors.closesAt = "Choose a whole-hour closing time.";
  } else if (HOUR_PATTERN.test(form.opensAt) && form.opensAt >= form.closesAt) {
    errors.closesAt = "Closing time must be after opening time.";
  }

  const amenities = parseAmenities(form.amenities);
  const normalizedAmenities = amenities.map((item) => item.toLowerCase());
  if (amenities.length > 20) {
    errors.amenities = "Enter no more than 20 amenities.";
  } else if (amenities.some((item) => item.length > 50)) {
    errors.amenities = "Each amenity must be 50 characters or fewer.";
  } else if (new Set(normalizedAmenities).size !== normalizedAmenities.length) {
    errors.amenities = "Remove duplicate amenities.";
  }

  return errors;
}

function toInput(form: FormState): ResourceInput {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    type: form.type,
    capacity: Number(form.capacity),
    location: form.location.trim(),
    amenities: parseAmenities(form.amenities),
    requiresApproval: form.requiresApproval,
    operatingDays: [...form.operatingDays].sort((a, b) => a - b),
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    buildingId: form.buildingId,
  };
}

interface AdminResourceManagerProps {
  user: User;
  resources: Resource[];
  buildings: Building[];
}

export function AdminResourceManager({
  user,
  resources: initialResources,
  buildings,
}: AdminResourceManagerProps) {
  const [resources, setResources] = useState(initialResources);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(buildings));
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);
  const [closures, setClosures] = useState<ResourceClosure[]>([]);
  const [closuresLoading, setClosuresLoading] = useState(false);
  const [closureDate, setClosureDate] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [closureError, setClosureError] = useState("");
  const [closureMessage, setClosureMessage] = useState("");
  const [closurePending, setClosurePending] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const closureDateRef = useRef<HTMLInputElement>(null);
  const closureFocusPendingRef = useRef(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const saveFocusPendingRef = useRef(false);
  const statusControlRefs = useRef(new Map<string, HTMLSelectElement>());
  const statusFocusPendingRef = useRef<string | null>(null);
  const mutationLockRef = useRef(false);
  const isMutating = isSaving || statusPendingId !== null || closurePending;

  useEffect(() => {
    let active = true;
    if (!editingId) {
      return () => {
        active = false;
      };
    }

    void getResourceClosures(editingId)
      .then((items) => {
        if (active) setClosures(items);
      })
      .catch((error: unknown) => {
        if (active) {
          if (
            error instanceof ResourceMutationError &&
            error.code === "session"
          ) {
            setSessionExpired(true);
          }
          setClosureError(
            error instanceof ResourceMutationError
              ? error.message
              : "Closure dates could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setClosuresLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editingId]);

  useEffect(() => {
    if (!isSaving && saveFocusPendingRef.current) {
      saveFocusPendingRef.current = false;
      saveButtonRef.current?.focus();
    }
  }, [isSaving]);

  useEffect(() => {
    if (!closurePending && closureFocusPendingRef.current) {
      closureFocusPendingRef.current = false;
      closureDateRef.current?.focus();
    }
  }, [closurePending]);

  useEffect(() => {
    const resourceId = statusFocusPendingRef.current;
    if (statusPendingId === null && resourceId) {
      statusFocusPendingRef.current = null;
      statusControlRefs.current.get(resourceId)?.focus();
    }
  }, [statusPendingId]);

  const counts = useMemo(
    () => ({
      total: resources.length,
      active: resources.filter((resource) => resource.status === "active")
        .length,
      maintenance: resources.filter(
        (resource) => resource.status === "maintenance",
      ).length,
      inactive: resources.filter((resource) => resource.status === "inactive")
        .length,
      approval: resources.filter((resource) => resource.requiresApproval)
        .length,
      buildings: new Set(resources.map((resource) => resource.building.id)).size,
    }),
    [resources],
  );

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError("");
    setMessage("");
  }

  function toggleOperatingDay(day: number) {
    const days = form.operatingDays.includes(day)
      ? form.operatingDays.filter((value) => value !== day)
      : [...form.operatingDays, day];
    updateField("operatingDays", days);
  }

  function focusEditor() {
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      editorRef.current?.scrollIntoView?.({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      editorRef.current?.focus({ preventScroll: true });
    });
  }

  function startCreate() {
    if (isMutating) return;
    setEditingId(null);
    setClosures([]);
    setClosuresLoading(false);
    setClosureError("");
    setClosureMessage("");
    setClosureDate("");
    setClosureReason("");
    setForm(emptyForm(buildings));
    setErrors({});
    setFormError("");
    setMessage("");
    focusEditor();
  }

  function startEdit(resource: Resource) {
    if (isMutating) return;
    setEditingId(resource.id);
    setClosures([]);
    setClosuresLoading(true);
    setClosureError("");
    setClosureMessage("");
    setClosureDate("");
    setClosureReason("");
    setForm(formFor(resource));
    setErrors({});
    setFormError("");
    setMessage("");
    focusEditor();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isMutating || mutationLockRef.current) return;

    const nextErrors = validate(form);
    setErrors(nextErrors);
    setFormError("");
    setMessage("");
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>("[aria-invalid='true']")
          ?.focus();
      });
      return;
    }

    mutationLockRef.current = true;
    setIsSaving(true);
    try {
      const saved = editingId
        ? await updateResource(editingId, toInput(form))
        : await createResource(toInput(form));
      setResources((current) => {
        const exists = current.some((resource) => resource.id === saved.id);
        const next = exists
          ? current.map((resource) =>
              resource.id === saved.id ? saved : resource,
            )
          : [...current, saved];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setMessage(editingId ? "Resource changes saved." : "Resource created.");
      if (!editingId) {
        setClosures([]);
        setClosuresLoading(true);
        setClosureError("");
        setClosureDate("");
        setClosureReason("");
      }
      setEditingId(saved.id);
      setForm(formFor(saved));
    } catch (error) {
      if (error instanceof ResourceMutationError && error.code === "session") {
        setSessionExpired(true);
        setFormError("");
      } else {
        setFormError(
          error instanceof ResourceMutationError
            ? error.message
            : "The resource could not be saved. Try again.",
        );
      }
    } finally {
      saveFocusPendingRef.current = true;
      mutationLockRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleClosureSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || isMutating || mutationLockRef.current) return;
    if (!closureDate || !closureReason.trim()) {
      setClosureError("Enter a closure date and reason.");
      setClosureMessage("");
      return;
    }

    mutationLockRef.current = true;
    setClosurePending(true);
    setClosureError("");
    setClosureMessage("");
    try {
      const closure = await createResourceClosure(editingId, {
        date: closureDate,
        reason: closureReason.trim(),
      });
      setClosures((current) =>
        [...current, closure].sort((a, b) => a.date.localeCompare(b.date)),
      );
      setClosureDate("");
      setClosureReason("");
      setClosureMessage(`Closure added for ${closure.date}.`);
    } catch (error) {
      if (error instanceof ResourceMutationError && error.code === "session") {
        setSessionExpired(true);
        setClosureError("");
      } else {
        setClosureError(
          error instanceof ResourceMutationError
            ? error.message
            : "The closure could not be added.",
        );
      }
    } finally {
      closureFocusPendingRef.current = true;
      mutationLockRef.current = false;
      setClosurePending(false);
    }
  }

  async function handleClosureDelete(closure: ResourceClosure) {
    if (!editingId || isMutating || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setClosurePending(true);
    setClosureError("");
    setClosureMessage("");
    try {
      await deleteResourceClosure(editingId, closure.id);
      setClosures((current) =>
        current.filter((item) => item.id !== closure.id),
      );
      setClosureMessage(`Closure removed for ${closure.date}.`);
    } catch (error) {
      if (error instanceof ResourceMutationError && error.code === "session") {
        setSessionExpired(true);
        setClosureError("");
      } else {
        setClosureError(
          error instanceof ResourceMutationError
            ? error.message
            : "The closure could not be removed.",
        );
      }
    } finally {
      closureFocusPendingRef.current = true;
      mutationLockRef.current = false;
      setClosurePending(false);
    }
  }

  async function handleStatus(resource: Resource, status: ResourceStatus) {
    if (resource.status === status || isMutating || mutationLockRef.current) {
      return;
    }
    mutationLockRef.current = true;
    statusFocusPendingRef.current = resource.id;
    setStatusPendingId(resource.id);
    setFormError("");
    setMessage("");
    try {
      const updated = await updateResourceStatus(resource.id, status);
      setResources((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage(
        `${updated.name} is now ${statusLabels[status].toLowerCase()}.`,
      );
    } catch (error) {
      if (error instanceof ResourceMutationError && error.code === "session") {
        setSessionExpired(true);
        setFormError("");
      } else {
        setFormError(
          error instanceof ResourceMutationError
            ? error.message
            : "The status could not be changed. Try again.",
        );
      }
    } finally {
      mutationLockRef.current = false;
      setStatusPendingId(null);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandMark />
        <nav className={styles.adminNav} aria-label="Administrator sections">
          <Link href="/admin/resources" aria-current="page">Resources</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/analytics">Analytics</Link>
        </nav>
        <div className={styles.identity}>
          <span>
            <strong>{user.fullName}</strong>
            <small>Administrator</small>
          </span>
          <LogoutButton
            className={styles.logout}
            errorClassName={styles.logoutError}
          />
        </div>
      </header>

      <div className={styles.shell}>
        <section
          className={styles.intro}
          aria-labelledby="resource-admin-title"
        >
          <div>
            <h1 id="resource-admin-title">Manage bookable resources</h1>
            <p>
              Keep campus rooms, laboratories, and equipment ready for search,
              approval, and booking.
            </p>
          </div>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={isMutating}
            onClick={startCreate}
          >
            Add resource
          </button>
        </section>

        {sessionExpired && (
          <p className={styles.errorMessage} role="alert">
            Your session has ended. {" "}
            <Link href="/login?next=/admin/resources">Sign in again</Link> to
            continue managing resources.
          </p>
        )}

        <section className={styles.summary} aria-label="Admin dashboard summary">
          <p>
            <strong>{counts.total}</strong>
            <span>Total resources</span>
          </p>
          <p>
            <strong>{counts.active}</strong>
            <span>Active</span>
          </p>
          <p>
            <strong>{counts.maintenance}</strong>
            <span>In maintenance</span>
          </p>
          <p>
            <strong>{counts.inactive}</strong>
            <span>Inactive</span>
          </p>
          <p>
            <strong>{counts.approval}</strong>
            <span>Require approval</span>
          </p>
          <p>
            <strong>{counts.buildings}</strong>
            <span>Buildings represented</span>
          </p>
        </section>

        <div className={styles.workspace}>
          <section className={styles.catalog} aria-labelledby="catalog-title">
            <div className={styles.sectionHeading}>
              <div>
                <h2 id="catalog-title">Resource catalog</h2>
                <p>Operational status can be changed directly in the list.</p>
              </div>
            </div>

            {resources.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>No resources yet</h3>
                <p>Add the first campus resource to begin the catalog.</p>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={startCreate}
                >
                  Add resource
                </button>
              </div>
            ) : (
              <>
                <p className={styles.tableScrollHint}>
                  Scroll the catalog to view booking rules and status.
                </p>
                <div
                  className={styles.tableWrap}
                  role="region"
                  aria-label="Scrollable campus resource catalog"
                  tabIndex={0}
                >
                  <table className={styles.table}>
                    <caption className={styles.srOnly}>
                      Campus resource catalog
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Resource</th>
                        <th scope="col">Building</th>
                        <th scope="col">Capacity</th>
                        <th scope="col">Booking rule</th>
                        <th scope="col">Status</th>
                        <th scope="col" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map((resource) => {
                        const Icon = iconFor(resource.type);
                        return (
                          <tr
                            key={resource.id}
                            className={
                              editingId === resource.id
                                ? styles.selectedRow
                                : undefined
                            }
                          >
                            <td>
                              <div className={styles.resourceName}>
                                <span>
                                  <Icon />
                                </span>
                                <p>
                                  <strong>{resource.name}</strong>
                                  <small>
                                    {resource.code} · {resource.type}
                                  </small>
                                </p>
                              </div>
                            </td>
                            <td>
                              <strong>{resource.building.code}</strong>
                              <small>{resource.location}</small>
                            </td>
                            <td>
                              <strong>{resource.capacity}</strong>
                              <small>
                                {resource.capacity === 1 ? "place" : "places"}
                              </small>
                            </td>
                            <td>
                              <span
                                className={styles.bookingRule}
                                data-approval={resource.requiresApproval}
                              >
                                {resource.requiresApproval
                                  ? "Staff approval"
                                  : "No approval"}
                              </span>
                            </td>
                            <td>
                              <label className={styles.statusControl}>
                                <span className={styles.srOnly}>
                                  Status for {resource.name}
                                </span>
                                <select
                                  ref={(element) => {
                                    if (element) {
                                      statusControlRefs.current.set(
                                        resource.id,
                                        element,
                                      );
                                    } else {
                                      statusControlRefs.current.delete(resource.id);
                                    }
                                  }}
                                  value={resource.status}
                                  data-status={resource.status}
                                  disabled={isMutating}
                                  onChange={(event) =>
                                    void handleStatus(
                                      resource,
                                      event.target.value as ResourceStatus,
                                    )
                                  }
                                >
                                  <option value="active">Active</option>
                                  <option value="maintenance">
                                    Maintenance
                                  </option>
                                  <option value="inactive">Inactive</option>
                                </select>
                              </label>
                            </td>
                            <td>
                              <button
                                className={styles.editButton}
                                type="button"
                                disabled={isMutating}
                                onClick={() => startEdit(resource)}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <aside
            ref={editorRef}
            className={styles.editor}
            aria-labelledby="editor-title"
            tabIndex={-1}
          >
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.context}>
                  {editingId ? "Editing resource" : "New resource"}
                </p>
                <h2 id="editor-title">
                  {editingId
                    ? form.name || "Resource details"
                    : "Add to catalog"}
                </h2>
              </div>
              {editingId && (
                <button
                  className={styles.textButton}
                  type="button"
                  disabled={isMutating}
                  onClick={startCreate}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <form
              ref={formRef}
              className={styles.form}
              onSubmit={handleSubmit}
              noValidate
            >
              <div className={styles.twoColumns}>
                <label>
                  Code
                  <input
                    aria-label="Code"
                    value={form.code}
                    maxLength={30}
                    disabled={isMutating}
                    aria-invalid={Boolean(errors.code)}
                    aria-describedby={
                      errors.code ? "resource-code-error" : undefined
                    }
                    onChange={(event) =>
                      updateField("code", event.target.value)
                    }
                  />
                  {errors.code && (
                    <small
                      className={styles.fieldError}
                      id="resource-code-error"
                    >
                      {errors.code}
                    </small>
                  )}
                </label>
                <label>
                  Type
                  <select
                    aria-label="Type"
                    value={form.type}
                    disabled={isMutating}
                    onChange={(event) =>
                      updateField("type", event.target.value as ResourceType)
                    }
                  >
                    {resourceTypes.map((type) => (
                      <option value={type.value} key={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Name
                <input
                  aria-label="Name"
                  value={form.name}
                  maxLength={120}
                  disabled={isMutating}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={
                    errors.name ? "resource-name-error" : undefined
                  }
                  onChange={(event) => updateField("name", event.target.value)}
                />
                {errors.name && (
                  <small className={styles.fieldError} id="resource-name-error">
                    {errors.name}
                  </small>
                )}
              </label>
              <label>
                Description
                <textarea
                  aria-label="Description"
                  value={form.description}
                  maxLength={1000}
                  disabled={isMutating}
                  rows={3}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                />
              </label>
              <div className={styles.twoColumns}>
                <label>
                  Building
                  <select
                    aria-label="Building"
                    value={form.buildingId}
                    disabled={isMutating}
                    aria-invalid={Boolean(errors.buildingId)}
                    aria-describedby={
                      errors.buildingId ? "resource-building-error" : undefined
                    }
                    onChange={(event) =>
                      updateField("buildingId", event.target.value)
                    }
                  >
                    <option value="">Choose a building</option>
                    {buildings.map((building) => (
                      <option value={building.id} key={building.id}>
                        {building.code} — {building.name}
                      </option>
                    ))}
                  </select>
                  {errors.buildingId && (
                    <small
                      className={styles.fieldError}
                      id="resource-building-error"
                    >
                      {errors.buildingId}
                    </small>
                  )}
                </label>
                <label>
                  Location
                  <input
                    aria-label="Location"
                    value={form.location}
                    maxLength={120}
                    placeholder="Floor or collection point"
                    disabled={isMutating}
                    aria-invalid={Boolean(errors.location)}
                    aria-describedby={
                      errors.location ? "resource-location-error" : undefined
                    }
                    onChange={(event) =>
                      updateField("location", event.target.value)
                    }
                  />
                  {errors.location && (
                    <small
                      className={styles.fieldError}
                      id="resource-location-error"
                    >
                      {errors.location}
                    </small>
                  )}
                </label>
              </div>
              <div className={styles.twoColumns}>
                <label>
                  Capacity
                  <input
                    aria-label="Capacity"
                    type="number"
                    min="1"
                    max="10000"
                    value={form.capacity}
                    disabled={isMutating}
                    aria-invalid={Boolean(errors.capacity)}
                    aria-describedby={
                      errors.capacity ? "resource-capacity-error" : undefined
                    }
                    onChange={(event) =>
                      updateField("capacity", event.target.value)
                    }
                  />
                  {errors.capacity && (
                    <small
                      className={styles.fieldError}
                      id="resource-capacity-error"
                    >
                      {errors.capacity}
                    </small>
                  )}
                </label>
                <label htmlFor="resource-amenities">
                  Amenities
                  <input
                    id="resource-amenities"
                    aria-label="Amenities"
                    value={form.amenities}
                    maxLength={1020}
                    placeholder="whiteboard, display"
                    disabled={isMutating}
                    aria-invalid={Boolean(errors.amenities)}
                    aria-describedby={
                      errors.amenities
                        ? "resource-amenities-hint resource-amenities-error"
                        : "resource-amenities-hint"
                    }
                    onChange={(event) =>
                      updateField("amenities", event.target.value)
                    }
                  />
                  <small id="resource-amenities-hint">
                    Separate items with commas.
                  </small>
                  {errors.amenities && (
                    <small
                      className={styles.fieldError}
                      id="resource-amenities-error"
                    >
                      {errors.amenities}
                    </small>
                  )}
                </label>
              </div>
              <fieldset
                className={styles.scheduleFields}
                tabIndex={-1}
                aria-invalid={Boolean(errors.operatingDays)}
                aria-describedby={
                  errors.operatingDays ? "resource-operating-days-error" : undefined
                }
              >
                <legend>Operating days</legend>
                <div>
                  {operatingDayOptions.map((day) => (
                    <label key={day.value}>
                      <input
                        type="checkbox"
                        checked={form.operatingDays.includes(day.value)}
                        disabled={isMutating}
                        onChange={() => toggleOperatingDay(day.value)}
                      />
                      <span>{day.label}</span>
                    </label>
                  ))}
                </div>
                {errors.operatingDays && (
                  <small
                    className={styles.fieldError}
                    id="resource-operating-days-error"
                  >
                    {errors.operatingDays}
                  </small>
                )}
              </fieldset>
              <div className={styles.twoColumns}>
                <label>
                  Opens at
                  <input
                    aria-label="Opens at"
                    type="time"
                    step="3600"
                    value={form.opensAt}
                    disabled={isMutating}
                    aria-invalid={Boolean(errors.opensAt)}
                    aria-describedby={
                      errors.opensAt ? "resource-opens-at-error" : undefined
                    }
                    onChange={(event) => updateField("opensAt", event.target.value)}
                  />
                  {errors.opensAt && (
                    <small
                      className={styles.fieldError}
                      id="resource-opens-at-error"
                    >
                      {errors.opensAt}
                    </small>
                  )}
                </label>
                <label>
                  Closes at
                  <input
                    aria-label="Closes at"
                    type="time"
                    step="3600"
                    value={form.closesAt}
                    disabled={isMutating}
                    aria-invalid={Boolean(errors.closesAt)}
                    aria-describedby={
                      errors.closesAt ? "resource-closes-at-error" : undefined
                    }
                    onChange={(event) => updateField("closesAt", event.target.value)}
                  />
                  {errors.closesAt && (
                    <small
                      className={styles.fieldError}
                      id="resource-closes-at-error"
                    >
                      {errors.closesAt}
                    </small>
                  )}
                </label>
              </div>
              <label className={styles.checkbox}>
                <input
                  aria-label="Staff approval required"
                  type="checkbox"
                  checked={form.requiresApproval}
                  disabled={isMutating}
                  onChange={(event) =>
                    updateField("requiresApproval", event.target.checked)
                  }
                />
                <span>
                  <strong>Staff approval required</strong>
                  <small>
                    Use for supervised laboratories and controlled equipment.
                  </small>
                </span>
              </label>

              <div
                className={styles.formStatus}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {formError && (
                  <p className={styles.errorMessage} role="alert">
                    {formError}
                  </p>
                )}
                {message && <p className={styles.successMessage}>{message}</p>}
              </div>
              <button
                ref={saveButtonRef}
                className={styles.saveButton}
                type="submit"
                disabled={isMutating || buildings.length === 0}
              >
                {isSaving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Create resource"}
              </button>
              {buildings.length === 0 && (
                <p className={styles.errorMessage} role="alert">
                  <MapPinIcon /> Add a building before creating resources.
                </p>
              )}
            </form>

            <section
              className={styles.closureManager}
              aria-labelledby="closure-manager-title"
            >
              <div>
                <p className={styles.context}>Date-specific exceptions</p>
                <h3 id="closure-manager-title">Scheduled closures</h3>
                <span>
                  Full-day closures use campus-local dates in ICT (UTC+7).
                </span>
              </div>
              {!editingId ? (
                <p className={styles.closureEmpty}>
                  Create or select a resource to manage closure dates.
                </p>
              ) : (
                <>
                  <form className={styles.closureForm} onSubmit={handleClosureSubmit}>
                    <label>
                      Closure date
                      <input
                        ref={closureDateRef}
                        type="date"
                        required
                        value={closureDate}
                        disabled={isMutating}
                        onChange={(event) => setClosureDate(event.target.value)}
                      />
                    </label>
                    <label>
                      Reason
                      <input
                        value={closureReason}
                        required
                        maxLength={255}
                        placeholder="Scheduled maintenance"
                        disabled={isMutating}
                        onChange={(event) => setClosureReason(event.target.value)}
                      />
                    </label>
                    <button type="submit" disabled={isMutating}>
                      {closurePending ? "Updating…" : "Add closure"}
                    </button>
                  </form>
                  <div role="status" aria-live="polite" aria-atomic="true">
                    {closureMessage && (
                      <p className={styles.successMessage}>{closureMessage}</p>
                    )}
                  </div>
                  {closureError && (
                    <p className={styles.errorMessage} role="alert">
                      {closureError}
                    </p>
                  )}
                  {closuresLoading ? (
                    <p className={styles.closureEmpty} role="status">
                      Loading closure dates…
                    </p>
                  ) : closures.length ? (
                    <ul className={styles.closureList}>
                      {closures.map((closure) => (
                        <li key={closure.id}>
                          <span>
                            <strong>{closure.date}</strong>
                            <small>{closure.reason}</small>
                          </span>
                          <button
                            type="button"
                            disabled={isMutating}
                            aria-label={`Remove closure on ${closure.date}`}
                            onClick={() => void handleClosureDelete(closure)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.closureEmpty}>
                      No closure dates are scheduled.
                    </p>
                  )}
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
