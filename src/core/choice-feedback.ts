export function choiceFeedback(
  node: { id: string; label: string; count: number; options: { id: string; label?: string }[] },
  actual: string[],
) {
  const duplicates = [...new Set(actual.filter((x, i) => actual.indexOf(x) !== i))],
    invalid = [...new Set(actual.filter((x) => !node.options.some((o) => o.id === x)))],
    valid = [...new Set(actual)].filter((x) => !invalid.includes(x))
  return {
    nodeId: node.id,
    expected: node.count,
    actual,
    validCount: valid.length,
    duplicates,
    invalid,
    allowed: node.options,
    messages: [
      ...(actual.length !== node.count
        ? [`需要选择 ${node.count} 项（当前 ${actual.length} 项，有效且不重复 ${valid.length} 项）`]
        : []),
      ...(duplicates.length ? ['重复ID：' + duplicates.join('、')] : []),
      ...(invalid.length ? ['非法ID／当前阶段不可选：' + invalid.join('、')] : []),
    ],
  }
}
