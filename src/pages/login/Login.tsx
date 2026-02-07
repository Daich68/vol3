import React, { useState, FormEvent, useEffect, useRef } from "react";
import { loginRequest, regRequest } from "../../api/Login";
import "./Login.css";
import { useNavigate } from "react-router-dom";
import { Token } from "../../entity/Entity";
import { GetAuthors } from "../../requests/Api";
import { safeLocalStorage } from "../../utils/localStorage";
import { PageFrame } from "../../components/PageFrame/PageFrame";
import gsap from "gsap";

export const Login: React.FC = () => {
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [msg, setMsg] = useState<string>("");
    const [isRegister, setIsRegister] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loginError, setLoginError] = useState<string>("");
    const [passwordError, setPasswordError] = useState<string>("");

    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".login-hero-title", {
                y: 40,
                opacity: 0,
                duration: 1.2,
                ease: "expo.out"
            });

            gsap.from(".login-card", {
                y: 30,
                opacity: 0,
                duration: 1,
                delay: 0.3,
                ease: "power2.out"
            });
        }, containerRef);
        return () => ctx.revert();
    }, []);

    const handleLogin = async (event: FormEvent) => {
        event.preventDefault();
        if (isLoading) return;
        setMsg("");
        setIsLoading(true);
        try {
            const token: Token = await loginRequest({ login, password });
            safeLocalStorage.clear();
            safeLocalStorage.setItem("accessToken", token.access);
            safeLocalStorage.setItem("ID", token._id);
            navigate(`/author/${token._id}`);
            return;
        } catch (error) {
            console.error("Login failed:", error);
            setMsg("не удалось зайти. проверьте данные или напишите на info@web-almanac.com");
        } finally {
            setIsLoading(false);
        }
    };

    const validatePassword = (password: string): boolean => {
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        return passwordRegex.test(password);
    };

    const validateLogin = (login: string): boolean => {
        const loginRegex = /^[A-Za-z\d\s]{5,}$/;
        return loginRegex.test(login);
    };

    const isLoginExist = async (login: string): Promise<boolean> => {
        try {
            const authors = await GetAuthors();
            return authors.some((author) => author.login === login);
        } catch (error) {
            console.error(error)
            return false;
        }
    };

    const handleLoginChange = (value: string) => {
        setLogin(value);
        setLoginError("");
        setMsg("");
    };

    const handlePasswordChange = (value: string) => {
        setPassword(value);
        setPasswordError("");
        setMsg("");
    };

    const handleRegister = async (event: FormEvent) => {
        event.preventDefault();
        if (isLoading) return;
        setMsg("");
        setLoginError("");
        setPasswordError("");

        if (password !== confirmPassword) {
            setMsg("пароли не совпадают");
            return;
        }

        if (!validatePassword(password)) {
            setPasswordError("минимум 8 символов: латиница и цифры");
            return;
        }

        if (!validateLogin(login)) {
            setLoginError("минимум 5 символов и буквы")
            return;
        }

        setIsLoading(true);
        try {
            let exist = await isLoginExist(login)
            if (exist) {
                setLoginError("такой логин уже существует")
                setIsLoading(false);
                return;
            }
            let token = await regRequest({ login, password });
            safeLocalStorage.clear();
            safeLocalStorage.setItem("accessToken", token.access);
            safeLocalStorage.setItem("ID", token._id);
            navigate(`/author/${token._id}`);
            return;
        } catch (error) {
            console.error("Registration failed:", error);
            setMsg("не удалось завершить регистрацию");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = () => {
        gsap.to(".login-card-inner", {
            opacity: 0,
            x: isRegister ? 20 : -20,
            duration: 0.3,
            onComplete: () => {
                setIsRegister(!isRegister);
                setMsg("");
                setLoginError("");
                setPasswordError("");
                setConfirmPassword("");
                gsap.fromTo(".login-card-inner",
                    { opacity: 0, x: isRegister ? -20 : 20 },
                    { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" }
                );
            }
        });
    };

    return (
        <PageFrame showScroll={false}>
            <div className="login" ref={containerRef}>
                <div className="login-hero">
                    <h1 className="login-hero-title">
                        {isRegister ? "creation" : "entrance"}
                    </h1>
                </div>

                <div className="login-container">
                    <div className="login-card">
                        <div className="login-card-border" />
                        <div className="login-card-inner">
                            <form className="login-form-premium" onSubmit={isRegister ? handleRegister : handleLogin}>
                                <div className="login-input-group">
                                    <label className="login-label">идентификатор</label>
                                    <input
                                        className="login-input-premium"
                                        type="text"
                                        value={login}
                                        onChange={(e) => handleLoginChange(e.target.value)}
                                        placeholder="..."
                                        required
                                    />
                                    {loginError && <span className="login-error-hint">{loginError}</span>}
                                </div>

                                <div className="login-input-group">
                                    <label className="login-label">ключ доступа</label>
                                    <input
                                        className="login-input-premium"
                                        type="password"
                                        value={password}
                                        onChange={(e) => handlePasswordChange(e.target.value)}
                                        placeholder="..."
                                        required
                                    />
                                    {passwordError && <span className="login-error-hint">{passwordError}</span>}
                                </div>

                                {isRegister && (
                                    <div className="login-input-group">
                                        <label className="login-label">повтор ключа</label>
                                        <input
                                            className="login-input-premium"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="..."
                                            required
                                        />
                                    </div>
                                )}

                                {msg && <div className="login-global-msg">{msg}</div>}

                                <button
                                    className="login-submit-btn"
                                    type="submit"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "синхронизация..." : (isRegister ? "создать аккаунт" : "войти в систему")}
                                </button>
                            </form>

                            <div className="login-switch">
                                <span className="switch-text">
                                    {isRegister ? "уже часть вольтри?" : "создать новую запись?"}
                                </span>
                                <button className="switch-btn" onClick={toggleMode} type="button">
                                    {isRegister ? "войти" : "зарегистрироваться"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </PageFrame>
    );
};
