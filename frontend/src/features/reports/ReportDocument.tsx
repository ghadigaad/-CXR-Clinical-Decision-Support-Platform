/**
 * PDF rendition of the clinical report.
 *
 * Built with @react-pdf/renderer rather than rasterizing the DOM so the output has
 * selectable, searchable text at any zoom - important for a document that may be filed
 * in a patient record or sent to a colleague.
 */
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { AI_DISCLAIMER, RESPONSIBILITY_NOTE } from '../../components/safety/Disclaimers';
import { formatDate, formatDateTime, formatGender, formatModelName, formatPercent } from '../../lib/utils';
import type { Analysis } from '../../types/api';

const COLORS = {
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  border: '#cbd5e1',
  hairline: '#e2e8f0',
  accent: '#1d4ed8',
  ai: '#6d28d9',
  aiBackground: '#f5f3ff',
  warning: '#b45309',
  warningBackground: '#fffbeb',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 9.5,
    lineHeight: 1.5,
    color: COLORS.text,
    fontFamily: 'Helvetica',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
    paddingBottom: 10,
    marginBottom: 16,
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: COLORS.text },
  subtitle: { fontSize: 9, color: COLORS.muted, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  statusPill: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#166534',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  statusPillDraft: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.warning,
    backgroundColor: COLORS.warningBackground,
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },

  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
    color: COLORS.muted,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
    paddingBottom: 3,
    marginBottom: 7,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '33.33%', marginBottom: 7, paddingRight: 8 },
  gridCellHalf: { width: '50%', marginBottom: 7, paddingRight: 8 },
  label: { fontSize: 7.5, color: COLORS.faint, marginBottom: 1 },
  value: { fontSize: 9.5 },
  valueBold: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },

  paragraph: { fontSize: 9.5, marginBottom: 5 },
  blockLabel: { fontSize: 7.5, color: COLORS.faint, marginBottom: 2, marginTop: 4 },

  predictionBox: {
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: COLORS.aiBackground,
    borderRadius: 4,
    padding: 10,
  },
  predictionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  predictionLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.text },
  predictionConfidence: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.ai },

  probRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    borderTopWidth: 1,
    borderTopColor: '#ede9fe',
  },

  aiTag: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.ai,
    letterSpacing: 0.5,
  },

  listItem: { flexDirection: 'row', marginBottom: 2.5 },
  bullet: { width: 10, fontSize: 9.5, color: COLORS.faint },
  listText: { flex: 1, fontSize: 9.5 },

  imageRow: { flexDirection: 'row', gap: 10 },
  imageBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    padding: 4,
    alignItems: 'center',
  },
  image: { width: '100%', height: 190, objectFit: 'contain' },
  imageCaption: { fontSize: 7.5, color: COLORS.faint, marginTop: 3 },

  mockBanner: {
    borderWidth: 1,
    borderColor: '#fbbf24',
    backgroundColor: COLORS.warningBackground,
    borderRadius: 4,
    padding: 8,
    marginBottom: 14,
  },
  mockTitle: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: COLORS.warning },
  mockBody: { fontSize: 8.5, color: COLORS.warning, marginTop: 2 },

  disclaimer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    backgroundColor: '#f8fafc',
    padding: 8,
    marginTop: 4,
  },
  disclaimerTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  disclaimerText: { fontSize: 8, color: COLORS.muted },

  signature: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
    fontSize: 8.5,
    color: COLORS.muted,
  },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: COLORS.faint,
  },
});

function Detail({
  label,
  value,
  half = false,
  bold = false,
}: {
  label: string;
  value: string;
  half?: boolean;
  bold?: boolean;
}) {
  return (
    <View style={half ? styles.gridCellHalf : styles.gridCell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={bold ? styles.valueBold : styles.value}>{value || '—'}</Text>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

export function ReportDocument({ analysis }: { analysis: Analysis }) {
  const patient = analysis.patient;
  const report = analysis.report;
  const review = analysis.review;
  const isFinalized = analysis.status === 'FINALIZED';
  const isMock = analysis.source === 'mock';

  const ranked = [...analysis.prediction.probabilities].sort(
    (a, b) => b.probability - a.probability,
  );

  const displayImage = analysis.image.display ?? analysis.image.thumbnail;

  return (
    <Document
      title={`CXR Report - ${patient?.medicalRecordNumber ?? analysis.id}`}
      author="CXR Decision Support"
      creator="CXR Decision Support"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>Chest Radiograph Report</Text>
            <Text style={styles.subtitle}>AI-assisted clinical decision support</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={isFinalized ? styles.statusPill : styles.statusPillDraft}>
              {isFinalized ? 'FINALIZED' : 'DRAFT — NOT FINALIZED'}
            </Text>
            <Text style={{ ...styles.subtitle, marginTop: 4 }}>
              {formatDateTime(analysis.createdAt)}
            </Text>
          </View>
        </View>

        {isMock ? (
          <View style={styles.mockBanner}>
            <Text style={styles.mockTitle}>
              SIMULATED OUTPUT — NOT A REAL MODEL PREDICTION
            </Text>
            <Text style={styles.mockBody}>
              This report was produced with a development stub that does not analyze images.
              The values below are placeholders and carry no clinical meaning.
            </Text>
          </View>
        ) : null}

        {patient ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient information</Text>
            <View style={styles.grid}>
              <Detail label="Name" value={patient.fullName} bold />
              <Detail label="Patient ID" value={patient.medicalRecordNumber} />
              <Detail label="Analysis date" value={formatDateTime(analysis.createdAt)} />
              <Detail label="Age" value={`${patient.age} years`} />
              <Detail label="Gender" value={formatGender(patient.gender)} />
              <Detail label="Date of birth" value={formatDate(patient.dateOfBirth)} />
            </View>
          </View>
        ) : null}

        {patient && (patient.clinicalHistory || patient.symptoms || patient.notes) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clinical information</Text>
            {patient.clinicalHistory ? (
              <>
                <Text style={styles.blockLabel}>CLINICAL HISTORY</Text>
                <Text style={styles.paragraph}>{patient.clinicalHistory}</Text>
              </>
            ) : null}
            {patient.symptoms ? (
              <>
                <Text style={styles.blockLabel}>PRESENTING SYMPTOMS</Text>
                <Text style={styles.paragraph}>{patient.symptoms}</Text>
              </>
            ) : null}
            {patient.notes ? (
              <>
                <Text style={styles.blockLabel}>NOTES</Text>
                <Text style={styles.paragraph}>{patient.notes}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        {displayImage ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Imaging</Text>
            <View style={styles.imageRow}>
              <View style={styles.imageBox}>
                <Image src={displayImage} style={styles.image} />
                <Text style={styles.imageCaption}>Chest radiograph as submitted</Text>
              </View>
              {analysis.image.heatmap ? (
                <View style={styles.imageBox}>
                  <Image src={analysis.image.heatmap} style={styles.image} />
                  <Text style={styles.imageCaption}>
                    Grad-CAM: regions influencing the prediction
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Imaging</Text>
            <Text style={{ ...styles.paragraph, color: COLORS.muted }}>
              The chest radiograph was not retained by this deployment. Image checksum
              (SHA-256): {analysis.image.checksum.slice(0, 32)}…
            </Text>
          </View>
        )}

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>AI findings</Text>
          <Text style={{ ...styles.aiTag, marginBottom: 5 }}>
            GENERATED BY {formatModelName(analysis.modelName ?? analysis.modelVersion)} ({analysis.modelVersion})
          </Text>

          <View style={styles.predictionBox}>
            <View style={styles.predictionRow}>
              <View>
                <Text style={styles.label}>PREDICTION</Text>
                <Text style={styles.predictionLabel}>{analysis.prediction.label}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.label}>CONFIDENCE</Text>
                <Text style={styles.predictionConfidence}>
                  {formatPercent(analysis.prediction.confidence)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.label}>RISK LEVEL</Text>
                <Text style={styles.valueBold}>{analysis.riskLevel}</Text>
              </View>
            </View>

            <Text style={{ ...styles.label, marginTop: 2 }}>CLASS PROBABILITIES</Text>
            {ranked.map((item) => (
              <View key={item.label} style={styles.probRow}>
                <Text style={{ fontSize: 9 }}>{item.label}</Text>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
                  {formatPercent(item.probability)}
                </Text>
              </View>
            ))}

            <Text style={{ fontSize: 7.5, color: COLORS.muted, marginTop: 6 }}>
              Risk level is derived by the reporting system from the model’s confidence; it is
              not an output of the model.
            </Text>
          </View>

          {report && report.observations.length > 0 ? (
            <>
              <Text style={styles.blockLabel}>OBSERVATIONS</Text>
              <BulletList items={report.observations} />
            </>
          ) : null}
        </View>

        {report?.impression ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Impression</Text>
            <Text style={styles.paragraph}>{report.impression}</Text>
          </View>
        ) : null}

        {report && report.recommendations.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <BulletList items={report.recommendations} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clinician review</Text>
          {review?.finalAssessment ? (
            <>
              <Text style={styles.blockLabel}>FINAL ASSESSMENT</Text>
              <Text style={styles.paragraph}>{review.finalAssessment}</Text>
            </>
          ) : (
            <Text style={{ ...styles.paragraph, color: COLORS.warning }}>
              No final clinical assessment has been recorded. This report is a draft.
            </Text>
          )}

          {review?.additionalFindings ? (
            <>
              <Text style={styles.blockLabel}>ADDITIONAL FINDINGS</Text>
              <Text style={styles.paragraph}>{review.additionalFindings}</Text>
            </>
          ) : null}

          {review?.comments ? (
            <>
              <Text style={styles.blockLabel}>COMMENTS</Text>
              <Text style={styles.paragraph}>{review.comments}</Text>
            </>
          ) : null}

          {review?.agreesWithAi !== null && review?.agreesWithAi !== undefined ? (
            <Text style={styles.paragraph}>
              Reviewing clinician {review.agreesWithAi ? 'agrees' : 'does not agree'} with the AI
              prediction.
            </Text>
          ) : null}

          {isFinalized && report?.finalizedAt ? (
            <Text style={styles.signature}>
              Electronically signed by {report.finalizedByName ?? 'reviewing clinician'} on{' '}
              {formatDateTime(report.finalizedAt)}.
            </Text>
          ) : null}
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>Important</Text>
          <Text style={styles.disclaimerText}>
            {AI_DISCLAIMER} {RESPONSIBILITY_NOTE}
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {patient ? `${patient.fullName} · ${patient.medicalRecordNumber}` : 'CXR report'}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
