import { useEffect, useState } from "react";
import "./profile.css";
import Navbar from "../components/Navbar";
import axios from "axios";
import toast from "react-hot-toast";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);

  const [form, setForm] = useState({
    name: "",
    username: "",
    phone: "",
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");

        const res = await axios.get(
          "http://localhost:5000/api/auth/me",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setUser(res.data);
        setForm({
          name: res.data.name,
          username: res.data.username,
          phone: res.data.phone || "",
        });
      } catch (err) {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.put(
        "http://localhost:5000/api/auth/me",
        form,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setUser(res.data);
      setEdit(false);
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.msg || "Update failed");
    }
  };

  if (loading) return <p className="loading">Loading profile...</p>;
  if (!user) return <p className="loading">Failed to load profile</p>;

  return (
    <>
      <Navbar isAuth={true} />

      <main className="page">
        <div className="page-header">
          <h2>My Profile</h2>
          <p className="subtitle">
            Manage your personal information and account settings
          </p>
        </div>

        <section className="profile-wrapper">

          <div className="profile-card">
            <div className="avatar">
              {user.name.charAt(0).toUpperCase()}
              {edit && (
                <span className="camera">
                  <i className="fa fa-camera"></i>
                </span>
              )}
            </div>

            <h3>{user.name}</h3>
            <span className="username">@{user.username}</span>
            <span className="badge">Citizen</span>

            <p className="member">
              Member since{" "}
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>


          <div className="info-card">
            <div className="info-header">
              <h3 className="account-title">
                <i className="fa-solid fa-user"></i> Account Information
              </h3>

              <div className="action-buttons">
                {!edit ? (
                  <button
                    className="btn primary"
                    onClick={() => setEdit(true)}
                  >
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      className="btn success"
                      onClick={handleSave}
                    >
                      Save
                    </button>
                    <button
                      className="btn danger"
                      onClick={() => {
                        setEdit(false);
                        setForm({
                          name: user.name,
                          username: user.username,
                          phone: user.phone || "",
                        });
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <form className="form-grid">
              <div>
                <label>Username</label>
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  readOnly={!edit}
                  className={!edit ? "readonly" : ""}
                />
              </div>

              <div>
                <label>Email</label>
                <input value={user.email} readOnly className="readonly" />
              </div>

              <div>
                <label>Full Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  readOnly={!edit}
                  className={!edit ? "readonly" : ""}
                />
              </div>


              <div>
                <label>Phone Number</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    if (value.length <= 10) {
                      setForm({ ...form, phone: value });
                    }
                  }}
                  readOnly={!edit}
                  className={!edit ? "readonly" : ""}
                  maxLength={10}
                  placeholder="10 digit number"
                />
              </div>
            </form>
          </div>
        </section>
      </main>
    </>
  );
};

export default Profile;
