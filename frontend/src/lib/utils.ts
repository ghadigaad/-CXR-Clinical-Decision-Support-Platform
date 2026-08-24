import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatGender(gender: string): string {
  const map: Record<string, string> = {
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Other',
    UNDISCLOSED: 'Undisclosed',
  };
  return map[gender] ?? gender;
}

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING_REVIEW: 'Pending review',
    REVIEWED: 'Reviewed',
    FINALIZED: 'Finalized',
  };
  return map[status] ?? status;
}

export function formatRiskLevel(risk: string): string {
  const map: Record<string, string> = { LOW: 'Low', MODERATE: 'Moderate', HIGH: 'High' };
  return map[risk] ?? risk;
}

export function formatModelName(versionOrName: string): string {
  if (versionOrName.includes('EfficientNet') || versionOrName.includes('DenseNet')) {
    return versionOrName;
  }
  if (versionOrName.includes('efficientnet')) return 'EfficientNetV2-B0';
  if (versionOrName.includes('densenet')) return 'DenseNet-121 + CBAM';
  if (versionOrName.startsWith('MOCK')) return 'Development stub';
  return versionOrName;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter((part) => part.length > 0 && !part.endsWith('.'))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
