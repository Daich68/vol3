import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ScrollProgress } from "../../components/ScrollProgress/ScrollProgress";
import "./Philosophy.css";

export const Philosophy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="philosophy">
      <ScrollProgress />
      <motion.button
        className="back-button"
        onClick={() => navigate("/")}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        ← назад
      </motion.button>

      <motion.div
        className="philosophy-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.h1
          className="philosophy-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          философия вольтри
        </motion.h1>

        <motion.section
          className="philosophy-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <h2 className="section-title">что такое вольтри?</h2>
          <div className="section-content">
            <p>
              вольтри — это не просто социальная сеть. это пространство для осознанного общения,
              где каждое слово имеет вес, а каждая мысль — ценность.
            </p>
            <p>
              мы создали место, где нет спешки, нет бесконечной ленты, нет давления
              постоянного присутствия. здесь есть только вы, ваши мысли и ваш язык.
            </p>
          </div>
        </motion.section>

        <motion.section
          className="philosophy-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <h2 className="section-title">электрическое дерево</h2>
          <div className="section-content">
            <p>
              вольтри иногда называют «электрическим деревом» — метафора, которая отражает
              суть проекта. как дерево растет медленно, укореняясь в земле, так и ваши
              мысли здесь требуют времени и внимания.
            </p>
            <p>
              электричество — это энергия, связь, импульс. каждый пост — это разряд,
              который остается в пространстве навсегда, формируя вашу историю и ваш язык.
            </p>
          </div>
        </motion.section>

        <motion.section
          className="philosophy-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <h2 className="section-title">три принципа</h2>
          <div className="principles-detailed">
            <div className="principle-detailed">
              <div className="principle-icon-large">◉</div>
              <h3>осознанность</h3>
              <p>
                каждое слово имеет значение. здесь нет места случайным мыслям или
                импульсивным реакциям. вы пишете, когда есть что сказать, и каждое
                ваше сообщение — это осознанный выбор.
              </p>
              <p>
                мы верим, что качество важнее количества. один пост в день — это
                возможность сконцентрироваться на том, что действительно важно.
              </p>
            </div>

            <div className="principle-detailed">
              <div className="principle-icon-large">◎</div>
              <h3>размеренность</h3>
              <p>
                в мире, где все требует немедленной реакции, вольтри предлагает
                замедлиться. один пост в день — это не ограничение, а освобождение
                от необходимости постоянно быть онлайн.
              </p>
              <p>
                это время для размышлений, для того чтобы прожить день и выбрать
                одну мысль, которой стоит поделиться. это ритм, который позволяет
                дышать.
              </p>
            </div>

            <div className="principle-detailed">
              <div className="principle-icon-large">◈</div>
              <h3>всматривание в себя</h3>
              <p>
                вольтри — это зеркало. здесь вы создаете свой собственный язык,
                свой словарик, который отражает ваше мышление и ваш внутренний мир.
              </p>
              <p>
                каждый пользователь — это автор собственного языка. со временем
                ваш словарик становится картой вашего сознания, историей ваших
                мыслей и эволюции.
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          className="philosophy-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <h2 className="section-title">ограничения как свобода</h2>
          <div className="section-content">
            <p>
              вольтри намеренно ограничивает вас. но эти ограничения — не тюрьма,
              а рамка, которая помогает сфокусироваться:
            </p>
            <ul className="philosophy-list">
              <li>
                <strong>один пост в день</strong> — учит выбирать главное и ценить
                момент
              </li>
              <li>
                <strong>лимит символов</strong> — заставляет быть точным и ясным
              </li>
              <li>
                <strong>невозможность редактирования</strong> — учит ответственности
                за свои слова
              </li>
              <li>
                <strong>невозможность удаления</strong> — создает честную историю
                вашего пути
              </li>
            </ul>
            <p>
              эти ограничения не мешают — они освобождают. они снимают давление
              перфекционизма и бесконечной оптимизации. то, что написано — написано.
              это ваша правда в этот момент времени.
            </p>
          </div>
        </motion.section>

        <motion.section
          className="philosophy-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          <h2 className="section-title">ваш личный язык</h2>
          <div className="section-content">
            <p>
              на вашей странице есть словарик — место, где вы определяете значения
              слов так, как вы их понимаете. это не просто список терминов, это
              ваша философия, ваш способ видеть мир.
            </p>
            <p>
              со временем ваш словарик становится ключом к пониманию ваших постов,
              вашего мышления, вашей эволюции. другие пользователи могут читать
              ваш словарик и понимать, на каком языке вы говорите.
            </p>
          </div>
        </motion.section>

        <motion.section
          className="philosophy-section philosophy-footer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <div className="section-content centered">
            <p className="footer-quote">
              используйте вольтри-язык, и просто оставайтесь здесь столько,
              сколько пожелаете
            </p>
            <p className="footer-subtext">
              это не гонка. это путь.
            </p>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
};
