import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../../config/prisma.js';
import { recordAudit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import { serializeAnalysis, serializePatient } from '../../lib/serializers.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { currentDoctor, requireAuth } from '../../middleware/auth.js';
import {
  createPatientSchema,
  listPatientsSchema,
  updatePatientSchema,
} from './patients.schema.js';

export const patientsRouter = Router();

patientsRouter.use(requireAuth);

patientsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const { search, page, pageSize } = listPatientsSchema.parse(req.query);

    const where: Prisma.PatientWhereInput = {
      doctorId: doctor.id,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { medicalRecordNumber: { contains: search } },
            ],
          }
        : {}),
    };

    const [total, patients] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { analyses: true } },
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true, predictedLabel: true, confidence: true, riskLevel: true },
          },
        },
      }),
    ]);

    res.json({
      patients: patients.map((patient) => ({
        ...serializePatient(patient),
        analysisCount: patient._count.analyses,
        latestAnalysis: patient.analyses[0]
          ? {
              createdAt: patient.analyses[0].createdAt.toISOString(),
              label: patient.analyses[0].predictedLabel,
              confidence: patient.analyses[0].confidence,
              riskLevel: patient.analyses[0].riskLevel,
            }
          : null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  }),
);

patientsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const input = createPatientSchema.parse(req.body);

    const duplicate = await prisma.patient.findUnique({
      where: {
        doctorId_medicalRecordNumber: {
          doctorId: doctor.id,
          medicalRecordNumber: input.medicalRecordNumber,
        },
      },
    });
    if (duplicate) {
      throw conflict(`A patient with ID "${input.medicalRecordNumber}" already exists.`);
    }

    const patient = await prisma.patient.create({
      data: { ...input, doctorId: doctor.id },
    });

    await recordAudit({
      doctorId: doctor.id,
      action: 'patient.create',
      entityType: 'Patient',
      entityId: patient.id,
      req,
    });

    res.status(201).json({ patient: serializePatient(patient) });
  }),
);

patientsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id, doctorId: doctor.id },
    });
    if (!patient) throw notFound('Patient not found.');

    res.json({ patient: serializePatient(patient) });
  }),
);

patientsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const input = updatePatientSchema.parse(req.body);

    // Scope the lookup to the signed-in clinician so an id from another account cannot
    // be probed or modified.
    const existing = await prisma.patient.findFirst({
      where: { id: req.params.id, doctorId: doctor.id },
    });
    if (!existing) throw notFound('Patient not found.');

    const patient = await prisma.patient.update({ where: { id: existing.id }, data: input });

    await recordAudit({
      doctorId: doctor.id,
      action: 'patient.update',
      entityType: 'Patient',
      entityId: patient.id,
      metadata: { fields: Object.keys(input) },
      req,
    });

    res.json({ patient: serializePatient(patient) });
  }),
);

patientsRouter.get(
  '/:id/analyses',
  asyncHandler(async (req, res) => {
    const doctor = currentDoctor(req);
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id, doctorId: doctor.id },
    });
    if (!patient) throw notFound('Patient not found.');

    const analyses = await prisma.analysis.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
      include: { report: true, review: true },
    });

    res.json({
      patient: serializePatient(patient),
      analyses: analyses.map((analysis) =>
        serializeAnalysis(analysis, { includeHeatmap: false, includeDisplayImage: false }),
      ),
    });
  }),
);
