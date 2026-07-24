export const HEALTH_THRESHOLDS = {
  blood_pressure: {
    systolic: { min: 90, max: 180, warningHigh: 140, warningLow: 100 },
    diastolic: { min: 60, max: 110, warningHigh: 90, warningLow: 65 },
    unit: 'mmHg',
  },
  blood_sugar: {
    fasting: { min: 70, max: 200, warningHigh: 126, warningLow: 70 },
    random: { min: 70, max: 250, warningHigh: 140, warningLow: 70 },
    unit: 'mg/dL',
  },
  weight: {
    min: 30, max: 250,
    unit: 'kg',
  },
};

export function isAbnormalValue(type: string, valueData: any): { abnormal: boolean; message: string } {
  if (type === 'blood_pressure') {
    const s = valueData?.systolic || 0;
    const d = valueData?.diastolic || 0;
    if (s >= HEALTH_THRESHOLDS.blood_pressure.systolic.max || d >= HEALTH_THRESHOLDS.blood_pressure.diastolic.max) {
      return { abnormal: true, message: `⚠️ Tansiyon çok yüksek: ${s}/${d} (Kritik: ${HEALTH_THRESHOLDS.blood_pressure.systolic.max}/${HEALTH_THRESHOLDS.blood_pressure.diastolic.max})` };
    }
    if (s >= HEALTH_THRESHOLDS.blood_pressure.systolic.warningHigh) {
      return { abnormal: true, message: `⚡ Tansiyon yüksek: ${s}/${d} (Normal üst sınır: 140/90)` };
    }
    return { abnormal: false, message: '' };
  }
  if (type === 'blood_sugar') {
    const val = valueData?.sugar || 0;
    if (val >= HEALTH_THRESHOLDS.blood_sugar.random.max) {
      return { abnormal: true, message: `⚠️ Kan şekeri çok yüksek: ${val} (Kritik: ${HEALTH_THRESHOLDS.blood_sugar.random.max})` };
    }
    if (val >= HEALTH_THRESHOLDS.blood_sugar.random.warningHigh) {
      return { abnormal: true, message: `⚡ Kan şekeri yüksek: ${val} (Normal üst sınır: 140)` };
    }
    return { abnormal: false, message: '' };
  }
  if (type === 'weight') {
    const val = valueData?.weight || 0;
    if (val >= HEALTH_THRESHOLDS.weight.max) {
      return { abnormal: true, message: `⚠️ Kilo çok yüksek: ${val}kg (Kritik: ${HEALTH_THRESHOLDS.weight.max}kg)` };
    }
    return { abnormal: false, message: '' };
  }
  return { abnormal: false, message: '' };
}
