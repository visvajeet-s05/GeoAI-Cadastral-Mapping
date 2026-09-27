/**
 * Scientific Discrepancy Analysis for GeoTRACE-AI
 * Implements proper measurement type distinction and uncertainty scoring
 */

import type { 
  DiscrepancyType, 
  DiscrepancyAnalysis, 
  MeasurementTypes,
  GeometrySource 
} from "../types/records";

export interface DiscrepancyInput {
  recordedValue: number;
  observedValue: number;
  measurementType: keyof MeasurementTypes;
  recordedSource: GeometrySource;
  observedSource: GeometrySource;
  tolerancePercent?: number;
}

export interface UncertaintyFactors {
  imageQuality: number; // 0-1
  boundaryVisibility: number; // 0-1
  fmbAgreement: number; // 0-1
  surveyGeometryAgreement: number; // 0-1
  roadAlignment: number; // 0-1
  buildingEvidence: number; // 0-1
  historicalConsistency: number; // 0-1
  neighboringConsistency: number; // 0-1
}

/**
 * Calculate area discrepancy with scientific classification
 */
export function calculateAreaDiscrepancy(input: DiscrepancyInput): DiscrepancyAnalysis {
  const { recordedValue, observedValue, measurementType, tolerancePercent = 5 } = input;

  // Calculate difference
  const difference = observedValue - recordedValue;
  const percentageDifference = (difference / recordedValue) * 100;

  // Determine discrepancy type based on measurement type and magnitude
  let discrepancyType: DiscrepancyType;
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  const absPercentDiff = Math.abs(percentageDifference);

  // Different tolerance for different measurement types
  const tolerance = getToleranceForMeasurementType(measurementType);
  
  if (absPercentDiff <= tolerance) {
    discrepancyType = 'PHYSICAL_CHANGE';
    severity = 'LOW';
  } else if (absPercentDiff <= tolerance * 2) {
    discrepancyType = 'POTENTIAL_AREA_MISMATCH';
    severity = 'MEDIUM';
  } else if (absPercentDiff <= tolerance * 4) {
    discrepancyType = 'POTENTIAL_BOUNDARY_SHIFT';
    severity = 'HIGH';
  } else {
    discrepancyType = 'POTENTIAL_ENCROACHMENT';
    severity = 'CRITICAL';
  }

  // Building footprint exceeding plot is treated differently
  if (measurementType === 'buildingGroundFootprintSqFt' && difference > 0) {
    if (absPercentDiff <= tolerance * 2) {
      discrepancyType = 'POTENTIAL_BUILDING_OVERLAP';
      severity = 'MEDIUM';
    } else {
      discrepancyType = 'POTENTIAL_ENCROACHMENT';
      severity = 'HIGH';
    }
  }

  return {
    discrepancyType,
    recordedValue,
    observedValue,
    difference,
    percentageDifference,
    measurementType,
    severity,
    requiresVerification: severity !== 'LOW',
    evidence: generateEvidence(input, discrepancyType),
  };
}

/**
 * Get tolerance percentage for different measurement types
 */
function getToleranceForMeasurementType(measurementType: keyof MeasurementTypes): number {
  switch (measurementType) {
    case 'plotAreaSqFt':
      return 5; // 5% tolerance for plot area
    case 'buildingGroundFootprintSqFt':
      return 8; // 8% tolerance for building footprint (construction variations)
    case 'builtUpAreaSqFt':
      return 10; // 10% tolerance for built-up area (floor calculations)
    case 'floorWiseBuiltUpAreaSqFt':
      return 12; // 12% tolerance for floor-wise calculations
    case 'permissibleBuiltUpAreaSqFt':
      return 5; // 5% tolerance for permitted area
    case 'fsi':
      return 0.1; // 0.1 tolerance for FSI
    case 'openSpaceAreaSqFt':
      return 15; // 15% tolerance for open space (landscaping variations)
    default:
      return 5;
  }
}

/**
 * Generate evidence based on discrepancy type
 */
function generateEvidence(input: DiscrepancyInput, discrepancyType: DiscrepancyType): string[] {
  const evidence: string[] = [];
  
  evidence.push(`Recorded: ${input.recordedValue} sq.ft (${input.recordedSource})`);
  evidence.push(`Observed: ${input.observedValue} sq.ft (${input.observedSource})`);
  evidence.push(`Difference: ${(input.observedValue - input.recordedValue).toFixed(2)} sq.ft`);
  evidence.push(`Percentage: ${((input.observedValue - input.recordedValue) / input.recordedValue * 100).toFixed(2)}%`);

  switch (discrepancyType) {
    case 'POTENTIAL_AREA_MISMATCH':
      evidence.push('Area difference exceeds tolerance - may indicate measurement method difference');
      break;
    case 'POTENTIAL_BOUNDARY_SHIFT':
      evidence.push('Possible boundary shift detected - verify with survey records');
      break;
    case 'POTENTIAL_BUILDING_OVERLAP':
      evidence.push('Building footprint may extend beyond recorded plot - check approved plans');
      break;
    case 'POTENTIAL_ENCROACHMENT':
      evidence.push('Significant spatial discrepancy detected - requires field survey verification');
      break;
    case 'RECORD_CONFLICT':
      evidence.push('Different official datasets disagree - consult authoritative records');
      break;
    case 'PHYSICAL_CHANGE':
      evidence.push('Minor physical change detected - within acceptable tolerance');
      break;
    case 'UNVERIFIED_CHANGE':
      evidence.push('Change detected without corresponding authorization record');
      break;
    case 'REQUIRES_FIELD_SURVEY':
      evidence.push('Automated analysis insufficient - field survey required');
      break;
  }

  return evidence;
}

/**
 * Calculate uncertainty score based on multiple factors
 */
export function calculateUncertaintyScore(factors: UncertaintyFactors): {
  score: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
} {
  // Weight each factor
  const weights = {
    imageQuality: 0.2,
    boundaryVisibility: 0.15,
    fmbAgreement: 0.15,
    surveyGeometryAgreement: 0.15,
    roadAlignment: 0.1,
    buildingEvidence: 0.1,
    historicalConsistency: 0.1,
    neighboringConsistency: 0.05,
  };

  // Calculate weighted score
  const score = 
    factors.imageQuality * weights.imageQuality +
    factors.boundaryVisibility * weights.boundaryVisibility +
    factors.fmbAgreement * weights.fmbAgreement +
    factors.surveyGeometryAgreement * weights.surveyGeometryAgreement +
    factors.roadAlignment * weights.roadAlignment +
    factors.buildingEvidence * weights.buildingEvidence +
    factors.historicalConsistency * weights.historicalConsistency +
    factors.neighboringConsistency * weights.neighboringConsistency;

  // Determine confidence level
  let level: 'HIGH' | 'MEDIUM' | 'LOW';
  if (score >= 0.85) {
    level = 'HIGH';
  } else if (score >= 0.60) {
    level = 'MEDIUM';
  } else {
    level = 'LOW';
  }

  return { score, level };
}

/**
 * Format discrepancy for display
 */
export function formatDiscrepancyForDisplay(analysis: DiscrepancyAnalysis): {
  title: string;
  description: string;
  colorClass: string;
  icon: string;
} {
  const titles: Record<DiscrepancyType, string> = {
    POTENTIAL_AREA_MISMATCH: 'Potential Area Mismatch',
    POTENTIAL_BOUNDARY_SHIFT: 'Potential Boundary Shift',
    POTENTIAL_BUILDING_OVERLAP: 'Potential Building Overlap',
    POTENTIAL_ENCROACHMENT: 'Potential Encroachment',
    RECORD_CONFLICT: 'Record Conflict',
    PHYSICAL_CHANGE: 'Physical Change',
    UNVERIFIED_CHANGE: 'Unverified Change',
    REQUIRES_FIELD_SURVEY: 'Requires Field Survey',
  };

  const descriptions: Record<DiscrepancyType, string> = {
    POTENTIAL_AREA_MISMATCH: `Recorded: ${analysis.recordedValue} sq.ft | Observed: ${analysis.observedValue} sq.ft | Difference: ${analysis.difference.toFixed(2)} sq.ft (${analysis.percentageDifference.toFixed(2)}%)`,
    POTENTIAL_BOUNDARY_SHIFT: `Boundary shift detected of ${Math.abs(analysis.difference).toFixed(2)} sq.ft (${analysis.percentageDifference.toFixed(2)}%) - verification required`,
    POTENTIAL_BUILDING_OVERLAP: `Building footprint exceeds plot by ${analysis.difference.toFixed(2)} sq.ft (${analysis.percentageDifference.toFixed(2)}%) - check approved plans`,
    POTENTIAL_ENCROACHMENT: `Significant spatial discrepancy of ${analysis.difference.toFixed(2)} sq.ft (${analysis.percentageDifference.toFixed(2)}%) - field survey required`,
    RECORD_CONFLICT: `Official records disagree by ${analysis.difference.toFixed(2)} sq.ft - consult authoritative source`,
    PHYSICAL_CHANGE: `Minor change of ${analysis.difference.toFixed(2)} sq.ft (${analysis.percentageDifference.toFixed(2)}%) - within tolerance`,
    UNVERIFIED_CHANGE: `Change detected without authorization record - verification needed`,
    REQUIRES_FIELD_SURVEY: `Analysis insufficient - requires on-site verification`,
  };

  const colorClasses: Record<DiscrepancyType, string> = {
    POTENTIAL_AREA_MISMATCH: 'text-amber-400',
    POTENTIAL_BOUNDARY_SHIFT: 'text-orange-400',
    POTENTIAL_BUILDING_OVERLAP: 'text-orange-500',
    POTENTIAL_ENCROACHMENT: 'text-red-400',
    RECORD_CONFLICT: 'text-purple-400',
    PHYSICAL_CHANGE: 'text-green-400',
    UNVERIFIED_CHANGE: 'text-yellow-400',
    REQUIRES_FIELD_SURVEY: 'text-blue-400',
  };

  return {
    title: titles[analysis.discrepancyType],
    description: descriptions[analysis.discrepancyType],
    colorClass: colorClasses[analysis.discrepancyType],
    icon: getIconForDiscrepancy(analysis.discrepancyType),
  };
}

function getIconForDiscrepancy(type: DiscrepancyType): string {
  switch (type) {
    case 'POTENTIAL_AREA_MISMATCH':
      return '⚠️';
    case 'POTENTIAL_BOUNDARY_SHIFT':
      return '📐';
    case 'POTENTIAL_BUILDING_OVERLAP':
      return '🏠';
    case 'POTENTIAL_ENCROACHMENT':
      return '🚫';
    case 'RECORD_CONFLICT':
      return '📋';
    case 'PHYSICAL_CHANGE':
      return '✅';
    case 'UNVERIFIED_CHANGE':
      return '❓';
    case 'REQUIRES_FIELD_SURVEY':
      return '🔍';
  }
}