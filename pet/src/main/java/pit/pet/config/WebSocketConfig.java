package pit.pet.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // 클라이언트가 구독할 수 있는 주제의 접두사 설정
        config.enableSimpleBroker("/topic");

        // 클라이언트가 메시지를 보낼 때 사용할 접두사 설정
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // WebSocket 연결 엔드포인트 등록
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // CORS 설정
                .withSockJS(); // SockJS 지원

        registry.addEndpoint("/ws-raw")
                .setAllowedOriginPatterns("*");
    }
}