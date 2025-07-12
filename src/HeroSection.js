import React from "react";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import "./HeroSection.css"; // CSS 파일 임포트

function HeroSection({ onScrollToSearch }) {
  // 캐러셀 슬라이드 데이터 정의
  const slides = [
    {
      // 첫 번째 슬라이드: 이미지 왼쪽, 텍스트 오른쪽
      image: "https://img.youtube.com/vi/oF4q7gLWZl0/maxresdefault.jpg", // 썸네일 이미지 URL
      title: "나의 재료로 레시피를 찾아보세요",
      subtitle: "하이엔드 요리를 쉽게 — 공격수 셰프",

      buttonText: "레시피 검색하기",
      buttonLink: "#all-menus",
      contentLayout: "image-left" // ✨ 레이아웃 타입: 이미지 왼쪽, 텍스트 오른쪽
    },
    {
      // 두 번째 슬라이드: 이미지 오른쪽, 텍스트 왼쪽
      image: "https://images.unsplash.com/photo-1542838101-71e956555543?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      title: "Eat it. Drink it. Kick it!", // ✨ 원래 타이틀
      subtitle: "와인바 킥 바로가기", // ✨ 원래 서브타이틀
     buttonText: "재료 둘러보기",
      buttonLink: "#all-menus",
      contentLayout: "image-right" // ✨ 레이아웃 타입: 이미지 오른쪽, 텍스트 왼쪽
    },
    {
      // 세 번째 슬라이드: 이미지 왼쪽, 텍스트 오른쪽
      image: "https://img.youtube.com/vi/s9bwLCRejTo/maxresdefault.jpg", // ✨ 세 번째 캐러셀 이미지 URL 업데이트
      title: "미식의 즐거움을 경험하세요",
      subtitle: "간편하게 즐기는 셰프의 요리",
      buttonText: "인기 레시피 보기",
      buttonLink: "#all-menus",
      contentLayout: "image-left" // ✨ 레이아웃 타입: 이미지 왼쪽, 텍스트 오른쪽
    }
  ];

  return (
    <div className="hero-carousel">
      <Carousel
        autoPlay={false} // 자동 재생 활성화
        infiniteLoop={true} // 무한 루프 활성화
        interval={5000} // 5초 간격으로 슬라이드 전환
        showThumbs={false} // 썸네일 내비게이션 숨김
        showStatus={false} // 현재 슬라이드 상태(숫자) 숨김
        showArrows={true} // 좌우 화살표 내비게이션 표시
        emulateTouch={true} // 터치 스와이프 활성화
        swipeable={true} // 스와이프 제스처 활성화
        stopOnHover={false} // 마우스 오버 시 자동 재생 정지 안 함
      >
        {slides.map((slide, index) => (
          // contentLayout 타입에 따라 클래스 추가
          <div key={index} className={`carousel-slide ${slide.contentLayout}`}>
            {/* 이미지 컨테이너 */}
            <div className="carousel-image-section">
              <img
                src={slide.image}
                alt={`slide-${index}`}
                // ✨ 모든 이미지가 잘리지 않고 전체가 보이도록 objectFit을 'contain'으로 설정
                style={{ objectFit: 'contain' }}
              />
            </div>

            {/* 텍스트 컨테이너 */}
            <div className="carousel-text-section">
              <h6 className="hero-title">{slide.title}</h6> {/* 제목 */}
              <p className="hero-subtitle">{slide.subtitle}</p> {/* 부제목 */}
              {slide.buttonText && ( // 버튼 텍스트가 있을 경우에만 버튼 렌더링
                <a
                  href={slide.buttonLink}
                  className="hero-button"
                  // '모든 메뉴' 링크일 경우 스크롤 함수 호출, 외부 링크는 새 탭에서 열기
                  onClick={slide.buttonLink.startsWith('#') ? onScrollToSearch : undefined}
                  target={slide.buttonLink.startsWith('http') ? '_blank' : '_self'}
                  rel={slide.buttonLink.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {slide.buttonText}
                </a>
              )}
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  );
}

export default HeroSection;
