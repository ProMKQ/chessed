# Chessed

A real-time multiplayer chess website with automatic matchmaking

### Implementation
\- Client: React with TypeScript (Vite)  
\- Server: Node.js with TypeScript  
\- Networking: REST for auth, websocket for gameplay  

### Goals
\- ELO-based matchmaking, server-side move validation  
\- Persistent accounts and game history  
\- Performance optimization  

### Non-Goals
\- Puzzles, lessons, tournaments, guilds or any other chess app bloat  
\- Guest play  

### Component diagram:
![image](https://www.plantuml.com/plantuml/png/ZLL1JzjC4BtxLyp7vKiEWDHZLLL0I0iIgm8cvT3siDXJnyNUjNR725JntpkPJPQ5Rg9UOi_CU-EtRoRsaIVjQEoxeiEV16J1jSsIe6uTLjHQK_n7I-mHXawt70nEDxs6JZ_PaS3tIDhemj-tPj1Ezr3PVh063PNqr25mutT5CUZgNZS8UxEkvT8U_2u0u0KBtuw7uGTe3toLaln4seLjsch3UiiSQHceV3EpXl2HSZYbgLhsceKs0bTg1_Ypxd7WCmfo5QJOv-ArkiNv3cdArhgB-XRd_oOjZpj3NQCJIBZDmqwiTZKSYcu1IqAmKJpx3Flx7rFJqZnBo6LJ9wIGq0MGd56ff12F92tIGg8j7kelPS_92fNe7j1bLcZ-E3Zq7WGGN5gdtinhrHbuBcE7EmO7rtOaz75q8SoX5nuTo8eAU1LAb5sMPDQxDIJ0L8fIsuLSZJWYb4-Ui1Um9B8oDWk-MyCjtfMskaTAJRqjGv0ZbEnsQmqeRNIpngzpgiaoPaik1_U-cqcrYWv--QamfRRTobDD6ewhYa5RzCyllgHsp3lBKGJMpB_JFdIIErPmQJqr3lrXUNNH4axtLiJJaqJ0PglYbYO3IKjAvGlHGEcMT91Yt1vu3zVOj2pUmQ4OPFYwCLWop98MBnpkm6APEdEe2Hds2NcD126FYwe4All1wBaXTCcsX3mZak75fl8NtXIaQJpHDWgFqXeJlYVYHmfYJZ9fvdpLNLiBIza7pEB391ahMgxHZnq9S5E9HYm6RiKGJQrfChqYi2Jhy7K_dlV_43vP--i3pcpVZwQjj7mQqzVVmK6w3TpmxERc4YRhmSLPJWkbKefIaH0UmKyo1FC7_lKmaRS0-ccHlZS_C35wpiINl-aap8R2xCK-leRpJ8iZDFNOTty0)

### ER diagram:
![image](https://github.com/user-attachments/assets/bed1f578-b46c-46fe-84bd-6d061463b9a8)

---

## Tests

Unit tests in `elo.test.ts` cover ELO rating calculations (and their symmetry) across various ratings and edge cases.
E2E tests in `e2e.ts` cover user registration, login, logout, session management, username and password validation, 
matchmaking, game connection and termination via resignation with ELO updates.

Four mutation tests were conducted with GitHub CI and pull requests:
1. Rounding mode change in ELO calculation was detected by unit tests. 
2. Missing return statement in auth middleware was detected thanks to TypeScript type checking.
3. Registration endpoint status code typo was detected by E2E tests. 
4. Inversion of the winner color on checkmate was not detected because E2E tests don't go through the checkmate code path.

The fourth mutation test shows that gameplay logic lacks test coverage.
This can be fixed if the final E2E test plays out the fool's mate instead of resigning. 
However, testing game logic is not a priority, as the project relies on chess.js, which has its own tests for that.
Much more important would be to add some tests that cover player disconnection and reconnection behavior.

---

## Performance
### Lighthouse benchmark results
> Incognito mode has been used to disable all extensions so they dont interfere with the measurements
<img width="2559" height="1526" alt="lighthouse" src="https://github.com/user-attachments/assets/3368f6b0-dadf-4ab4-b771-7f1ddde53cee" />
<img width="787" height="397" alt="lighthouse-metrics" src="https://github.com/user-attachments/assets/164f927d-80af-4482-a746-83685de3c53f" />

