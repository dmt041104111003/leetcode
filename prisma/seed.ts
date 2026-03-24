import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu seed (Ca thi, Lớp, Thí sinh, Câu hỏi, Đề thi)...');

  await prisma.examQuestion.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.sessionExaminee.deleteMany();
  await prisma.session.deleteMany();
  await prisma.classExaminee.deleteMany();
  await prisma.class.deleteMany();
  await prisma.examinee.deleteMany();

  const session1 = await prisma.session.create({
    data: {
      code: 'UTC_CNTT_2025_CA1',
      name: 'Ca 1 - Thi Lập trình Cơ sở - Sáng 08/03/2025',
      startAt: new Date('2025-03-08T07:00:00+07:00'),
      endAt: new Date('2025-03-08T09:30:00+07:00'),
    },
  });

  const session2 = await prisma.session.create({
    data: {
      code: 'UTC_CNTT_2025_CA2',
      name: 'Ca 2 - Thi Lập trình Cơ sở - Chiều 08/03/2025',
      startAt: new Date('2025-03-08T13:00:00+07:00'),
      endAt: new Date('2025-03-08T15:30:00+07:00'),
    },
  });

  const session3 = await prisma.session.create({
    data: {
      code: 'UTC_CNTT_2025_CA3',
      name: 'Ca 3 - Thi Lập trình Cơ sở - Sáng 09/03/2025',
      startAt: new Date('2025-03-09T07:00:00+07:00'),
      endAt: new Date('2025-03-09T09:30:00+07:00'),
    },
  });

  const examinees = await Promise.all([
    prisma.examinee.create({ data: { mssv: '221231041', fullName: 'Đào Mạnh Tùng' } }),
    prisma.examinee.create({ data: { mssv: '221231042', fullName: 'Nguyễn Thị Hương Lan' } }),
    prisma.examinee.create({ data: { mssv: '221231043', fullName: 'Trần Văn Đức' } }),
    prisma.examinee.create({ data: { mssv: '221231044', fullName: 'Lê Thị Minh Anh' } }),
    prisma.examinee.create({ data: { mssv: '221231045', fullName: 'Phạm Quang Huy' } }),
    prisma.examinee.create({ data: { mssv: '221231046', fullName: 'Hoàng Minh Tuấn' } }),
    prisma.examinee.create({ data: { mssv: '221231047', fullName: 'Vũ Thị Ngọc Bích' } }),
    prisma.examinee.create({ data: { mssv: '221231048', fullName: 'Đặng Văn Khoa' } }),
    prisma.examinee.create({ data: { mssv: '231234001', fullName: 'Bùi Thị Thanh Hà' } }),
    prisma.examinee.create({ data: { mssv: '231234002', fullName: 'Ngô Đức Anh' } }),
    prisma.examinee.create({ data: { mssv: '231234003', fullName: 'Dương Minh Quân' } }),
  ]);

  await prisma.sessionExaminee.createMany({
    data: [
      { sessionId: session1.id, examineeId: examinees[0].id },
      { sessionId: session1.id, examineeId: examinees[1].id },
      { sessionId: session1.id, examineeId: examinees[2].id },
      { sessionId: session1.id, examineeId: examinees[3].id },
      { sessionId: session1.id, examineeId: examinees[4].id },
      { sessionId: session1.id, examineeId: examinees[5].id },
      { sessionId: session2.id, examineeId: examinees[4].id },
      { sessionId: session2.id, examineeId: examinees[5].id },
      { sessionId: session2.id, examineeId: examinees[6].id },
      { sessionId: session2.id, examineeId: examinees[7].id },
      { sessionId: session2.id, examineeId: examinees[8].id },
      { sessionId: session2.id, examineeId: examinees[9].id },
      { sessionId: session3.id, examineeId: examinees[8].id },
      { sessionId: session3.id, examineeId: examinees[9].id },
      { sessionId: session3.id, examineeId: examinees[10].id },
    ],
  });

  const class1 = await prisma.class.create({
    data: { code: 'CNTT_K24', name: 'Lớp Công nghệ thông tin K24' },
  });
  const class2 = await prisma.class.create({
    data: { code: 'CNTT_K25', name: 'Lớp Công nghệ thông tin K25' },
  });
  await prisma.classExaminee.createMany({
    data: [
      { classId: class1.id, examineeId: examinees[0].id },
      { classId: class1.id, examineeId: examinees[1].id },
      { classId: class1.id, examineeId: examinees[2].id },
      { classId: class1.id, examineeId: examinees[3].id },
      { classId: class1.id, examineeId: examinees[4].id },
      { classId: class1.id, examineeId: examinees[5].id },
      { classId: class2.id, examineeId: examinees[6].id },
      { classId: class2.id, examineeId: examinees[7].id },
      { classId: class2.id, examineeId: examinees[8].id },
      { classId: class2.id, examineeId: examinees[9].id },
      { classId: class2.id, examineeId: examinees[10].id },
    ],
  });

  const twoSum = await prisma.problem.create({
    data: {
      slug: 'two-sum',
      title: 'Two Sum',
      description: `Cho mảng số nguyên \`nums\` và một số \`target\`, trả về **chỉ số** của hai phần tử có tổng bằng \`target\`.

Giả sử mỗi input có đúng một đáp án và không dùng cùng một phần tử hai lần.

Bạn có thể trả về đáp án theo thứ tự bất kỳ.`,
      difficulty: 'EASY',
      constraints: `- \`2 <= nums.length <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`
- Chỉ tồn tại **một** cặp đáp án hợp lệ.`,
      examples: [
        { input: 'nums = [2, 7, 11, 15], target = 9', output: '[0, 1]', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
        { input: 'nums = [3, 2, 4], target = 6', output: '[1, 2]', explanation: null },
        { input: 'nums = [3, 3], target = 6', output: '[0, 1]', explanation: null },
      ],
      starterCode: {
        python: 'def twoSum(self, nums: list[int], target: int) -> list[int]:\n    pass',
        javascript: 'function twoSum(nums, target) {\n}',
      },
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      sortOrder: 0,
    },
  });

  await prisma.testCase.createMany({
    data: [
      { problemId: twoSum.id, input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isSample: true, sortOrder: 0 },
      { problemId: twoSum.id, input: '[3,2,4]\n6', expectedOutput: '[1,2]', isSample: true, sortOrder: 1 },
      { problemId: twoSum.id, input: '[3,3]\n6', expectedOutput: '[0,1]', isSample: true, sortOrder: 2 },
      { problemId: twoSum.id, input: '[1,5,3,7]\n10', expectedOutput: '[2,3]', isSample: false, sortOrder: 3 },
    ],
  });

  const validParentheses = await prisma.problem.create({
    data: {
      slug: 'valid-parentheses',
      title: 'Valid Parentheses',
      description: `Cho chuỗi \`s\` chỉ gồm \`(\`, \`)\`, \`{\`, \`}\`, \`[\`, \`]\`. Xác định chuỗi có **hợp lệ** không.

Chuỗi hợp lệ khi:
- Mở ngoặc phải đóng đúng loại.
- Mở ngoặc phải đóng đúng thứ tự.
- Mỗi cặp ngoặc đóng tương ứng đúng với cặp mở.`,
      difficulty: 'EASY',
      constraints: `- \`1 <= s.length <= 10^4\`
- \`s\` chỉ gồm \`()[]{}\`.`,
      examples: [
        { input: 's = "()"', output: 'true', explanation: null },
        { input: 's = "()[]{}"', output: 'true', explanation: null },
        { input: 's = "(]"', output: 'false', explanation: null },
      ],
      starterCode: {
        python: 'def isValid(self, s: str) -> bool:\n    pass',
        javascript: 'function isValid(s) {\n}',
      },
      timeLimitMs: 1000,
      memoryLimitMb: 64,
      sortOrder: 1,
    },
  });

  await prisma.testCase.createMany({
    data: [
      { problemId: validParentheses.id, input: '"()"', expectedOutput: 'true', isSample: true, sortOrder: 0 },
      { problemId: validParentheses.id, input: '"()[]{}"', expectedOutput: 'true', isSample: true, sortOrder: 1 },
      { problemId: validParentheses.id, input: '"(]"', expectedOutput: 'false', isSample: true, sortOrder: 2 },
      { problemId: validParentheses.id, input: '"([)]"', expectedOutput: 'false', isSample: false, sortOrder: 3 },
    ],
  });

  const exam1 = await prisma.exam.create({
    data: {
      code: 'LAPTRINH_CS_2025',
      name: 'Đề thi Lập trình Cơ sở - 2025',
      description: 'Đề gồm 2 bài: Two Sum, Valid Parentheses.',
    },
  });
  await prisma.examQuestion.createMany({
    data: [
      { examId: exam1.id, problemId: twoSum.id, sortOrder: 0, points: 5 },
      { examId: exam1.id, problemId: validParentheses.id, sortOrder: 1, points: 5 },
    ],
  });

  const exam2 = await prisma.exam.create({
    data: {
      code: 'ON_TAP_LEETCODE',
      name: 'Đề ôn tập',
      description: 'Bài Two Sum.',
    },
  });
  await prisma.examQuestion.createMany({
    data: [
      { examId: exam2.id, problemId: twoSum.id, sortOrder: 0, points: 10 },
    ],
  });

  await prisma.session.updateMany({
    where: { id: { in: [session1.id, session2.id] } },
    data: { examId: exam1.id },
  });
  await prisma.session.update({
    where: { id: session3.id },
    data: { examId: exam1.id },
  });
  await prisma.sessionClass.createMany({
    data: [
      { sessionId: session1.id, classId: class1.id },
      { sessionId: session2.id, classId: class1.id },
      { sessionId: session3.id, classId: class2.id },
    ],
  });

  console.log('Seed xong: sessions, session_classes, classes, examinees, session_examinees, class_examinees, problems, test_cases, exams, exam_questions.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
