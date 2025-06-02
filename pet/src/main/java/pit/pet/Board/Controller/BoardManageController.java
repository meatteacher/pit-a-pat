package pit.pet.Board.Controller;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import pit.pet.Account.Repository.DogRepository;
import pit.pet.Account.User.Dog;
import pit.pet.Account.User.User;
import pit.pet.Board.Entity.BoardImgTable;
import pit.pet.Board.Entity.BoardTable;
import pit.pet.Board.Service.BoardManageService;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Controller
@RequiredArgsConstructor
@RequestMapping("/board")
public class BoardManageController {

    private final BoardManageService boardManageService;
    private final DogRepository dogRepository;

    @GetMapping("/groups/{gno}")
    public String showGroupPage(@PathVariable Long gno, Model model) {
        List<BoardTable> posts = boardManageService.getPostsByGroup(gno);
        model.addAttribute("posts", posts);
        System.out.println("✅ posts.size(): " + posts.size());
        return "group/groupPage"; // 이 뷰 경로는 네가 실제로 사용하는 경로로 바꿔!
    }

    @GetMapping("/api/groups/{gno}/posts")
    @ResponseBody
    public List<Map<String, Object>> getPostsByGroup(@PathVariable Long gno, HttpSession session) {
        Long dno = resolveDnoOrNull(session); // ⭐️ null 가능! 에러 안 던짐
        List<BoardTable> posts = boardManageService.getPostsByGroup(gno);

        System.out.println("🔍 posts.size(): " + posts.size());
        posts.forEach(p -> System.out.println("🔍 post: " + p.getBcontent()));

        return posts.stream().map(post -> {
            Map<String, Object> map = new HashMap<>();
            map.put("bno", post.getBno());
            map.put("bcontent", post.getBcontent());
            map.put("dno", post.getWriterdog() != null ? post.getWriterdog().getDno() : null);
            map.put("writerDogName", post.getWriterdog() != null ? post.getWriterdog().getDname() : "알 수 없음");
            map.put("gno", post.getGroup() != null ? post.getGroup().getGno() : null);
            map.put("images", post.getImages() != null ?
                    post.getImages().stream().map(BoardImgTable::getBiurl).collect(Collectors.toList()) :
                    new ArrayList<>()
            );
            map.put("commentCount", post.getCommentCount());
            // 좋아요/북마크: dno 없으면 false 반환됨
            map.put("liked", boardManageService.isBoardLiked(post.getBno(), dno));
            map.put("bookmarked", boardManageService.isBoardBookmarked(post.getBno(), dno));

            return map;
        }).collect(Collectors.toList());
    }

    // ✅ 좋아요 토글
    @PostMapping("/{bno}/like")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> toggleLike(@PathVariable Long bno,
                                                          @RequestParam(required = false) Long dno,
                                                          HttpSession session) {
        try {
            dno = resolveDno(dno, session);
            boolean isLiked = boardManageService.toggleLike(bno, dno);

            BoardTable board = boardManageService.findByIdWithAllRelations(bno);
            long currentLikeCount = board.getBlikecount();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("isLiked", isLiked);
            response.put("likeCount", currentLikeCount);
            response.put("message", isLiked ? "좋아요 등록 완료!" : "좋아요 취소 완료!");
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
        } catch (IllegalArgumentException e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "좋아요 처리 중 알 수 없는 오류가 발생했습니다.");
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    // ✅ 북마크 토글
    @PostMapping("/{bno}/bookmark")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> toggleBookmark(@PathVariable Long bno,
                                                              @RequestParam(required = false) Long dno,
                                                              HttpSession session) {
        try {
            dno = resolveDno(dno, session);
            boolean isBookmarked = boardManageService.toggleBookmark(bno, dno);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("isBookmarked", isBookmarked);
            response.put("message", isBookmarked ? "북마크 등록 완료!" : "북마크 취소 완료!");
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
        } catch (IllegalArgumentException e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "북마크 처리 중 알 수 없는 오류가 발생했습니다.");
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    // ✅ dno 결정 메서드 (🔍 로그 추가됨)
    private Long resolveDno(Long dno, HttpSession session) {
        System.out.println("🔍 [resolveDno] 전달된 dno: " + dno);
        if (dno != null) {
            System.out.println("✅ [resolveDno] dno 직접 사용: " + dno);
            return dno;
        }

        Dog loginDog = (Dog) session.getAttribute("loginDog");
        System.out.println("🔍 [resolveDno] 세션 loginDog: " + loginDog);
        if (loginDog != null) {
            System.out.println("✅ [resolveDno] loginDog 사용: " + loginDog.getDno());
            return loginDog.getDno();
        }

        User loginUser = (User) session.getAttribute("loginUser");
        System.out.println("🔍 [resolveDno] 세션 loginUser: " + loginUser);
        if (loginUser != null) {
            List<Dog> dogs = dogRepository.findByOwner(loginUser);
            System.out.println("🔍 [resolveDno] loginUser가 소유한 강아지 수: " + dogs.size());
            if (!dogs.isEmpty()) {
                System.out.println("✅ [resolveDno] 첫 번째 강아지 사용: " + dogs.get(0).getDno());
                return dogs.get(0).getDno();
            }
        }

        System.out.println("⛔ [resolveDno] dno를 결정할 수 없음");
        throw new IllegalStateException("dno를 결정할 수 없습니다. 로그인 강아지 또는 유저 정보가 세션에 없습니다.");
    }

    // ✅ dno를 찾되, 없으면 null 반환 (에러 던지지 않음)
    private Long resolveDnoOrNull(HttpSession session) {
        System.out.println("🔍 [resolveDnoOrNull] 시도 시작!");
        Dog loginDog = (Dog) session.getAttribute("loginDog");
        if (loginDog != null) {
            System.out.println("✅ [resolveDnoOrNull] loginDog 사용: " + loginDog.getDno());
            return loginDog.getDno();
        }

        User loginUser = (User) session.getAttribute("loginUser");
        if (loginUser != null) {
            List<Dog> dogs = dogRepository.findByOwner(loginUser);
            if (!dogs.isEmpty()) {
                System.out.println("✅ [resolveDnoOrNull] 첫 번째 강아지 사용: " + dogs.get(0).getDno());
                return dogs.get(0).getDno();
            }
        }

        System.out.println("⚠️ [resolveDnoOrNull] dno를 찾을 수 없음. null 반환");
        return null;
    }
}

