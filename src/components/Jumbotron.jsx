const Jumbotron = () => {
  return (
    <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-5 rounded-lg w-full border border-gray-600">
      <div class=" text-white p-6 rounded-lg shadow-lg">
        <h1 class="text-3xl font-bold mb-4">NFL Power Rankings Model</h1>
        <p class="mb-6">
          Our NFL Power Rankings model leverages advanced machine learning
          techniques to evaluate and rank the performance of NFL teams based on
          a comprehensive set of metrics. This model is designed to provide an
          objective and data-driven assessment of team strength throughout the
          season.
        </p>
        <h3 class="text-2xl font-semibold mb-4">Model Overview</h3>
        <p class="mb-6">
          The model uses a neural network architecture to predict team
          performance and generate power rankings. It consists of multiple dense
          layers, each designed to capture complex relationships between various
          performance metrics. The model is trained on historical and real-time
          game data, ensuring that the rankings are both accurate and
          up-to-date.
        </p>
        <h3 class="text-2xl font-semibold mb-4">Input Features</h3>
        <p class="mb-6">
          The model's input features are meticulously chosen to encompass all
          critical aspects of a team's performance. These features include:
        </p>
        <div class="ml-4 mb-6">
          <h4 class="text-xl font-semibold mb-2">Offensive Metrics</h4>
          <ul class="list-disc list-inside mb-4">
            <li>
              <span className="font-bold">Offensive Yards:</span> Total yards
              gained on offense.
            </li>
            <li>
              <span className="font-bold">Passing Yards:</span> Total yards
              gained through passing plays.
            </li>
            <li>
              <span className="font-bold">Rushing Yards:</span> Total yards
              gained through rushing plays.
            </li>
            <li>
              <span className="font-bold">Completion Percentage:</span>{' '}
              Percentage of completed passes.
            </li>
            <li>
              <span className="font-bold">First Downs:</span> Total first downs
              achieved.
            </li>
            <li>
              <span className="font-bold">Third Down Conversions:</span>{' '}
              Successful third down conversion attempts.
            </li>
            <li>
              <span className="font-bold">Fourth Down Conversions:</span>{' '}
              Successful fourth down conversion attempts.
            </li>
            <li>
              <span className="font-bold">Red Zone Conversions:</span>{' '}
              Successful red zone attempts resulting in scores.
            </li>
          </ul>
          <h4 class="text-xl font-semibold mb-2">Defensive Metrics</h4>
          <ul class="list-disc list-inside mb-4">
            <li>
              <span className="font-bold">Opponent Offensive Yards:</span> Total
              yards allowed to the opponent.
            </li>
            <li>
              <span className="font-bold">Opponent Passing Yards:</span> Passing
              yards allowed to the opponent.
            </li>
            <li>
              <span className="font-bold">Opponent Rushing Yards:</span> Rushing
              yards allowed to the opponent.
            </li>
            <li>
              <span className="font-bold">Opponent Completion Percentage:</span>{' '}
              Opponent's pass completion rate.
            </li>
            <li>
              <span className="font-bold">Opponent First Downs:</span> First
              downs allowed to the opponent.
            </li>
            <li>
              <span className="font-bold">
                Opponent Third Down Conversions:
              </span>{' '}
              Third down conversions allowed.
            </li>
            <li>
              <span className="font-bold">
                Opponent Fourth Down Conversions:
              </span>{' '}
              Fourth down conversions allowed.
            </li>
            <li>
              <span className="font-bold">Opponent Red Zone Conversions:</span>{' '}
              Red zone attempts resulting in scores by the opponent.
            </li>
          </ul>
          <h4 class="text-xl font-semibold mb-2">Special Teams Metrics</h4>
          <ul class="list-disc list-inside mb-4">
            <li>
              <span className="font-bold">Kick Return Yards:</span> Yards gained
              on kick returns.
            </li>
            <li>
              <span className="font-bold">Punt Return Yards:</span> Yards gained
              on punt returns.
            </li>
            <li>
              <span className="font-bold">Field Goals Made:</span> Total
              successful field goals.
            </li>
            <li>
              <span className="font-bold">Punts:</span> Total punts made.
            </li>
          </ul>
          <h4 class="text-xl font-semibold mb-2">Turnovers and Penalties</h4>
          <ul class="list-disc list-inside mb-4">
            <li>
              <span className="font-bold">Turnovers:</span> Total giveaways by
              the team.
            </li>
            <li>
              <span className="font-bold">Takeaways:</span> Total takeaways from
              the opponent.
            </li>
            <li>
              <span className="font-bold">Penalties:</span> Total number of
              penalties.
            </li>
            <li>
              <span className="font-bold">Penalty Yards:</span> Total yards lost
              due to penalties.
            </li>
          </ul>
          <h4 class="text-xl font-semibold mb-2">Time of Possession</h4>
          <ul class="list-disc list-inside mb-4">
            <li>
              <span className="font-bold">Time of Possesion:</span>Time the team
              controls the ball per game, converted to seconds for consistency.
            </li>
          </ul>
          <h4 class="text-xl font-semibold mb-2">Scoring Metrics</h4>
          <ul class="list-disc list-inside mb-4">
            <li>
              <span className="font-bold">Score:</span> Total points scored by
              the team.
            </li>
            <li>
              <span className="font-bold">Opponent Score:</span> Total points
              scored by the opponent.
            </li>
          </ul>
        </div>
        <p class="mb-6">
          By combining these features, our model provides a holistic view of
          each team's performance, allowing for accurate and fair rankings. The
          model is continuously updated with the latest game data, ensuring that
          the power rankings reflect the most current team performances.
        </p>
      </div>
    </div>
  );
};
export default Jumbotron;
