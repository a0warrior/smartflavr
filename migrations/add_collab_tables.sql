CREATE TABLE grocery_list_collaborators (
  id INT PRIMARY KEY AUTO_INCREMENT,
  grocery_list_id INT NOT NULL,
  user_id INT NOT NULL,
  invited_by INT NOT NULL,
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_glc (grocery_list_id, user_id)
);

CREATE TABLE meal_plan_collaborators (
  id INT PRIMARY KEY AUTO_INCREMENT,
  owner_user_id INT NOT NULL,
  collaborator_user_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_mpc (owner_user_id, collaborator_user_id)
);
