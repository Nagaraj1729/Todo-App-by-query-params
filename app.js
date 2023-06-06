const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "todoApplication.db");

const { format } = require("date-fns");

const app = express();
app.use(express.json());

let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB Error - ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//Validate query parameters Middleware function API
const validateQueryParams = (request, response, next) => {
  const priorities = [
    "LOW",
    "low",
    "MEDIUM",
    "medium",
    "HIGH",
    "high",
    undefined,
  ];
  const statuses = [
    "TO DO",
    "to do",
    "IN PROGRESS",
    "in progress",
    "DONE",
    "done",
    undefined,
  ];
  const categories = [
    "WORK",
    "work",
    "HOME",
    "home",
    "LEARNING",
    "learning",
    undefined,
  ];
  const { priority, status, category } = request.query;
  if (priorities.includes(priority) === false) {
    response.status(400);
    response.send("Invalid Todo Priority");
  } else if (statuses.includes(status) === false) {
    response.status(400);
    response.send("Invalid Todo Status");
  } else if (categories.includes(category) === false) {
    response.status(400);
    response.send("Invalid Todo Category");
  } else {
    next();
  }
};

//Validate property values Middleware function API
const validatePropertyValues = (request, response, next) => {
  const priorities = ["LOW", "MEDIUM", "HIGH", undefined];
  const statuses = ["TO DO", "IN PROGRESS", "DONE", undefined];
  const categories = ["WORK", "HOME", "LEARNING", undefined];

  const { priority, status, category, dueDate } = request.body;

  if (priorities.includes(priority) === false) {
    response.status(400);
    response.send("Invalid Todo Priority");
  } else if (statuses.includes(status) === false) {
    response.status(400);
    response.send("Invalid Todo Status");
  } else if (categories.includes(category) === false) {
    response.status(400);
    response.send("Invalid Todo Category");
  } else {
    if (dueDate === undefined) {
      next();
    } else {
      try {
        format(new Date(dueDate), "yyyy-MM-dd");
        next();
      } catch (e) {
        response.status(400);
        response.send("Invalid Due Date");
      }
    }
  }
};

//Validate Due Date API
const validateQueryDueDate = (request, response, next) => {
  try {
    const { date } = request.query;
    const formattedDate = format(new Date(date), "yyyy-MM-dd");
    request.formattedDueDate = formattedDate;
    next();
  } catch (e) {
    response.status(400);
    response.send("Invalid Due Date");
  }
};

//Get todos API
app.get("/todos/", validateQueryParams, async (request, response) => {
  const {
    search_q = "",
    priority = "",
    status = "",
    category = "",
  } = request.query;
  const getTodosQuery = `
            SELECT
                id, todo, priority, status, category,
                due_date as dueDate 
            FROM todo
            WHERE
                    todo LIKE '%${search_q}%'
                AND priority LIKE '%${priority}%'
                AND status LIKE '%${status}%'
                AND category LIKE '%${category}%'
        `;
  const todosList = await db.all(getTodosQuery);
  response.send(todosList);
});

//Get specific todo API
app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const getTodoQuery = `
        SELECT 
            id, todo, priority, status, category,
            due_date as dueDate
        FROM todo WHERE id = ${todoId}`;
  const todoDetails = await db.get(getTodoQuery);
  response.send(todoDetails);
});

//Get todo by due date API
app.get("/agenda/", validateQueryDueDate, async (request, response) => {
  const { formattedDueDate } = request;
  const getTodoByDueDateQuery = `
            SELECT 
                id, todo, priority, status, category,
                due_date as dueDate
            FROM todo
            WHERE
                due_date = '${formattedDueDate}'
        `;
  const todo = await db.all(getTodoByDueDateQuery);
  response.send(todo);
});

//Add new Todo API
app.post("/todos/", validatePropertyValues, async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body;

  const checkTodoQuery = `SELECT * FROM todo WHERE id=${id}`;
  const dbResponse = await db.all(checkTodoQuery);

  if (dbResponse.length > 0) {
    response.send("todoId already exists");
  } else {
    const formattedDueDate = format(new Date(dueDate), "yyyy-MM-dd");
    const addTodoQuery = `
            INSERT INTO 
                todo (id, todo, priority, status, category, due_date)
            VALUES (
                ${id},
                '${todo}',
                '${priority}',
                '${status}',
                '${category}',
                '${formattedDueDate}'
            )
        `;
    await db.run(addTodoQuery);
    response.send("Todo Successfully Added");
  }
});

//Update Todo API
app.put("/todos/:todoId", validatePropertyValues, async (request, response) => {
  const { todoId } = request.params;
  const dataToUpdate = request.body;
  let property = Object.getOwnPropertyNames(dataToUpdate)[0];
  const valueToUpdate = dataToUpdate[property];
  if (property === "dueDate") {
    property = "due_date";
  }
  const updateTodoQuery = `
            UPDATE todo
            SET
                ${property} = '${valueToUpdate}'
            WHERE
                id = ${todoId}                
        `;
  await db.run(updateTodoQuery);
  if (property === "due_date") {
    response.send("Due Date Updated");
  } else {
    const column = property.slice(0, 1).toUpperCase() + property.slice(1);
    response.send(`${column} Updated`);
  }
});

//Delete Todo API
app.delete("/todos/:todoId", async (request, response) => {
  const { todoId } = request.params;
  const deleteTodoQuery = `
            DELETE FROM todo WHERE id = ${todoId}
        `;
  await db.run(deleteTodoQuery);
  response.send("Todo Deleted");
});

module.exports = app;
