/** Video tổng kết theo tên đề thi — phụ đề đồng bộ theo đoạn (giây). */
export const SUMMARY_VIDEOS = {
  'Trung thu vui vẻ': {
    title: 'Sự tích chú Cuội cung trăng',
    url: '/media/videos/su_tich_chu_cuoi_trung_thu.mp4',
    bgmUrl: '/media/videos/amthanh.mp3',
    bgmVolume: 0.55,
    cues: [
      {
        start: 0,
        end: 5,
        text: '🌕 Sự tích chú Cuội cung trăng — câu chuyện Trung thu',
      },
      {
        start: 5,
        end: 10,
        text: 'Ngày xưa, tiều phu Cuội vào rừng sâu… gặp bốn chú cọp con bên hang.',
      },
      {
        start: 10,
        end: 15,
        text: 'Cọp mẹ đớp lá thuốc thần kỳ, mớm cho con — chúng sống lại ngay!',
      },
      {
        start: 15,
        end: 20,
        text: 'Cuội đào cây «cải tử hoàn sinh» mang về, cứu sống ông lão trên đường.',
      },
      {
        start: 20,
        end: 25,
        text: 'Trồng cây góc vườn phía đông, tưới nước giếng trong — cứu giúp muôn người.',
      },
      {
        start: 25,
        end: 30,
        text: 'Cuội cứu chó trung thành, cứu vợ… tiếng đồn phép lạ lan khắp nơi.',
      },
      {
        start: 30,
        end: 35,
        text: 'Cây đa bật gốc bay lên trời — Cuội níu rễ, theo cây lên cung trăng!',
      },
      {
        start: 35,
        end: 40,
        text: 'Chú Cuội ngồi gốc đa trên trăng… Chúc các bạn Trung thu thật vui vẻ! 🥮🏮',
      },
    ],
  },
}

export function getSummaryVideo(examTitle) {
  if (!examTitle) return null
  return SUMMARY_VIDEOS[examTitle] || null
}
