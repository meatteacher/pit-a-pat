package pit.pet.Group.Controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pit.pet.Account.Repository.DogRepository;
import pit.pet.Account.Repository.UserRepository;
import pit.pet.Account.User.Dog;
import pit.pet.Account.User.User;
import pit.pet.Board.Entity.BoardTable;
import pit.pet.Board.Service.BoardManageService;
import pit.pet.Group.Repository.GroupMemberRepository;
import pit.pet.Group.Request.ApplyGroupRequest;
import pit.pet.Group.Request.CreateGroupRequest;
import pit.pet.Group.Request.UpdateMemberStatusRequest;
import pit.pet.Group.Service.GroupMemberService;
import pit.pet.Group.Service.GroupService;
import pit.pet.Group.entity.GroupMemberTable;
import pit.pet.Group.entity.GroupTable;
import pit.pet.Group.entity.GroupTableDTO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
@RequiredArgsConstructor
@RequestMapping("/groups")
public class GroupController {
    private final GroupService groupService;
    private final GroupMemberService groupMemberService;
    private final DogRepository dogRepository;
    private final UserRepository userRepository;
    private final BoardManageService boardManageService;
    private final GroupMemberRepository groupMemberRepository;

    // 그룹 생성 폼 페이지
    @GetMapping("/create")
    public String createGroupForm(Model model,
                                  @AuthenticationPrincipal UserDetails principal) {
        User me = userRepository.findByUemail(principal.getUsername())
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        List<Dog> myDogs = dogRepository.findByOwner(me);

        model.addAttribute("createGroupRequest", new CreateGroupRequest());
        model.addAttribute("myDogs", myDogs);

        return "Group/Create";
    }

    @GetMapping("/api/my-dogs")
    @ResponseBody
    public ResponseEntity<?> getMyDogs(@AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body("로그인이 필요합니다.");
        }

        User me = userRepository.findByUemail(principal.getUsername())
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        List<Dog> myDogs = dogRepository.findByOwner(me);

        List<Map<String, Object>> dogDtos = myDogs.stream().map(dog -> {
            Map<String, Object> dogMap = new HashMap<>();
            dogMap.put("dno", dog.getDno());
            dogMap.put("dname", dog.getDname());
            dogMap.put("avatarUrl", dog.getImage() != null ? "/uploads/img/" + dog.getImage() : "/groups/images/default_avatar.jpg");
            return dogMap;
        }).toList();

        return ResponseEntity.ok(dogDtos);
    }

    // ✅ 1. Form submit 처리
    @PostMapping("/create")
    public String createGroup(@ModelAttribute @Valid CreateGroupRequest request,
                              @AuthenticationPrincipal UserDetails principal) {

        if (principal == null) {
            throw new RuntimeException("로그인이 필요합니다.");
        }

        User me = userRepository.findByUemail(principal.getUsername())
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        Dog dog = dogRepository.findById(request.getDogId())
                .orElseThrow(() -> new RuntimeException("대표 강아지를 찾을 수 없습니다."));

        // JS처럼 interest 따로 선택X, Form submit 시에는 그냥 넘어오는 걸로 가정
        if (request.getInterest() == null) {
            throw new RuntimeException("관심사(키워드)를 선택하지 않았습니다.");
        }

        groupService.createGroup(request, dog);

        return "redirect:/groups/list";
    }

    // ✅ 2. AJAX (JSON) 처리
    @PostMapping("/api/create")
    @ResponseBody
    public ResponseEntity<?> createGroupViaApi(@ModelAttribute @Valid CreateGroupRequest request,
                                               @RequestParam(value = "gimg", required = false) MultipartFile gimg,
                                               @AuthenticationPrincipal UserDetails principal) {

        if (principal == null) {
            return ResponseEntity.status(401).body("로그인이 필요합니다.");
        }

        User me = userRepository.findByUemail(principal.getUsername())
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        Dog dog = dogRepository.findById(request.getDogId())
                .orElseThrow(() -> new RuntimeException("대표 강아지를 찾을 수 없습니다."));

        if (request.getInterest() == null) {
            return ResponseEntity.badRequest().body("관심사(키워드)를 선택하지 않았습니다.");
        }

        // ✅ 서비스로 이미지까지 같이 넘기기
        request.setGimg(gimg);
        groupService.createGroup(request, dog);

        return ResponseEntity.ok("그룹 생성 완료!");
    }


    // 전체 그룹, 가입한 그룹 보여주기
    @GetMapping("/list")
    public String groupList(Model model,
                            @AuthenticationPrincipal UserDetails principal) {
        // 🔥 전체 그룹 목록
        List<GroupTableDTO> groups = groupService.getAllGroups();
        model.addAttribute("groupList", groups);

        // 🔥 리더 이름 맵 만들기
        Map<Long, String> leaderNames = new HashMap<>();
        for (GroupTableDTO group : groups) {
            Long leaderGmno = group.getGleader(); // GroupMemberTable의 PK
            groupMemberRepository.findById(leaderGmno).ifPresent(member -> {
                leaderNames.put(group.getGno(), member.getDog().getDname());
            });
        }
        model.addAttribute("leaderNames", leaderNames);

        // ✅ 로그인 한 경우에만 "내 그룹" 정보 전달
        if (principal != null) {
            User me = userRepository.findByUemail(principal.getUsername())
                    .orElseThrow();
            List<Dog> myDogs = dogRepository.findByOwner(me);
            model.addAttribute("myDogs", myDogs);
            List<GroupMemberTable> myMemberships = groupMemberService.findByDogs(myDogs);
            model.addAttribute("myMemberships", myMemberships);

            // 추가: 로그인 여부도 Thymeleaf에서 사용할 수 있도록
            model.addAttribute("isAuthenticated", true);
        } else {
            // 비로그인인 경우
            model.addAttribute("isAuthenticated", false);
        }

        return "Group/Group";
    }

    @GetMapping("/api/all")
    @ResponseBody
    public List<GroupTableDTO> getAllGroups() {
        return groupService.getAllGroups();
    }

    @GetMapping("/api/my-groups")
    @ResponseBody
    public List<GroupTableDTO> getMyGroups(@AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return List.of();  // 로그인하지 않았다면 빈 배열 반환
        }

        User me = userRepository.findByUemail(principal.getUsername())
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));

        // `GroupService`에서 DTO로 변환된 그룹 목록 반환
        return groupService.getMyGroups(me);
    }

    //현재 접속자 지위 확인

    @GetMapping("/{gno}/menu-status")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getGroupMenuStatus(@PathVariable Long gno, @AuthenticationPrincipal UserDetails principal) {
        // 로그인한 사용자 확인
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }

        // principal에서 이메일(Username) 가져오기
        String username = principal.getUsername();  // principal은 UserDetails 타입

        // 이메일을 통해 User 객체 찾기
        User me = userRepository.findByUemail(username)
                .orElseThrow(() -> new RuntimeException("해당 이메일로 가입된 사용자가 없습니다."));

        // 사용자의 강아지 목록 가져오기
        List<Dog> myDogs = dogRepository.findByOwner(me);

        // 사용자 강아지 중 리더인지 확인
        String status = groupService.checkUserStatus(gno, me.getUno());

        // 리더의 gmno 가져오기
        Long leaderGmno = groupMemberService.getLeaderGmno(gno, myDogs);

        // 결과 맵 생성
        Map<String, Object> result = new HashMap<>();
        result.put("status", status); // 사용자 상태 (LEADER, MEMBER, NOT_JOINED)
        result.put("gleader", leaderGmno); // 리더 gmno 값 반환

        return ResponseEntity.ok(result);  // 상태와 리더 정보 반환
    }

    // 그룹 가입 신청 폼 (강아지 선택)
    @GetMapping("/{gno}/apply")
    public String showApplyForm(@PathVariable Long gno,
                                @AuthenticationPrincipal UserDetails principal,
                                Model model) {
        User me = userRepository.findByUemail(principal.getUsername())
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        List<Dog> myDogs = dogRepository.findByOwner(me);

        model.addAttribute("gno", gno);
        model.addAttribute("myDogs", myDogs);
        return "Group/Apply";
    }

    // 그룹 가입 신청 처리
    @PostMapping("/{gno}/apply")
    public String applyGroup(@PathVariable Long gno,
                             @ModelAttribute ApplyGroupRequest request) {
        Dog dog = dogRepository.findById(request.getDogId())
                .orElseThrow(() -> new RuntimeException("해당 강아지를 찾을 수 없습니다."));
        groupMemberService.applyMembership(gno, dog);
        return "redirect:/groups/list";
    }

    // 가입 요청 관리 폼 (리더만 가능)
    @GetMapping("/{gno}/manage")
    public String manageGroup(@PathVariable Long gno,
                              @AuthenticationPrincipal UserDetails principal,
                              Model model) {
        User me = userRepository.findByUemail(principal.getUsername())
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        List<Dog> myDogs = dogRepository.findByOwner(me);

        Long leaderGmno = groupMemberService.getLeaderGmno(gno, myDogs);

        if (leaderGmno == null) {
            throw new RuntimeException("접근 권한이 없습니다. (리더만 접근 가능)");
        }

        List<GroupMemberTable> members = groupMemberService.getAllMembers(gno);

        model.addAttribute("groupId", gno);
        model.addAttribute("leaderGmno", leaderGmno);
        model.addAttribute("members", members);
        return "Group/Manage";
    }

    // 가입 승인/거절 처리
    @PostMapping("/{gno}/members/{gmno}/status")
    public String updateMemberStatus(@PathVariable Long gno,
                                     @PathVariable Long gmno,
                                     @ModelAttribute UpdateMemberStatusRequest request) {
        groupMemberService.handleJoinRequest(gmno, request.getStatus(), request.getLeaderGmno());
        return "redirect:/groups/" + gno + "/manage";
    }

    // 멤버 탈퇴
    @GetMapping("/mygroups")
    public String myGroups(@AuthenticationPrincipal UserDetails principal,
                           Model model) {
        User me = userRepository.findByUemail(principal.getUsername())
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        List<Dog> myDogs = dogRepository.findByOwner(me);

        List<GroupMemberTable> myMemberships = groupMemberService.findByDogs(myDogs);

        model.addAttribute("myMemberships", myMemberships);
        return "Group/Mygroups";
    }

    @PostMapping("/members/{gmno}/withdraw")
    public String withdraw(@PathVariable Long gmno,
                           @RequestParam Long requesterGmno) {
        groupMemberService.withdraw(gmno, requesterGmno);
        return "redirect:/groups/mygroups";
    }

    @PostMapping("/{gno}/delegate")
    public String delegateLeader(@PathVariable Long gno,
                                 @RequestParam Long newLeaderGmno,
                                 @RequestParam Long currentLeaderGmno) {
        groupService.changeLeader(gno, currentLeaderGmno, newLeaderGmno);

        return "redirect:/groups/list";
    }

    @GetMapping("/{gno}")
    public String groupDetail(@PathVariable Long gno, Model model) {
        GroupTable group = groupService.findById(gno);

        model.addAttribute("group", group);

        return "Group/Group_board";
    }
}