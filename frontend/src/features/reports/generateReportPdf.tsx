/**
 * Lazy entry point for PDF generation.
 *
 * Kept in its own module so the @react-pdf/renderer bundle is fetched only when a
 * clinician actually exports a report, rather than on every page load.
 */
import { pdf } from '@react-pdf/renderer';

import type { Analysis } from '../../types/api';
import { ReportDocument } from './ReportDocument';

export async function generateReportPdf(analysis: Analysis): Promise<Blob> {
  return pdf(<ReportDocument analysis={analysis} />).toBlob();
}
